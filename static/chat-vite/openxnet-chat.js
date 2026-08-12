// @__NO_SIDE_EFFECTS__
function co(e) {
  const t = /* @__PURE__ */ Object.create(null);
  for (const n of e.split(",")) t[n] = 1;
  return (n) => n in t;
}
const ve = {}, dn = [], xt = () => {
}, Ei = () => !1, ys = (e) => e.charCodeAt(0) === 111 && e.charCodeAt(1) === 110 && // uppercase letter
(e.charCodeAt(2) > 122 || e.charCodeAt(2) < 97), _s = (e) => e.startsWith("onUpdate:"), Ee = Object.assign, uo = (e, t) => {
  const n = e.indexOf(t);
  n > -1 && e.splice(n, 1);
}, Kl = Object.prototype.hasOwnProperty, re = (e, t) => Kl.call(e, t), Q = Array.isArray, pn = (e) => Wn(e) === "[object Map]", Ii = (e) => Wn(e) === "[object Set]", qo = (e) => Wn(e) === "[object Date]", Y = (e) => typeof e == "function", we = (e) => typeof e == "string", St = (e) => typeof e == "symbol", le = (e) => e !== null && typeof e == "object", Ri = (e) => (le(e) || Y(e)) && Y(e.then) && Y(e.catch), Li = Object.prototype.toString, Wn = (e) => Li.call(e), Wl = (e) => Wn(e).slice(8, -1), Ni = (e) => Wn(e) === "[object Object]", fo = (e) => we(e) && e !== "NaN" && e[0] !== "-" && "" + parseInt(e, 10) === e, In = /* @__PURE__ */ co(
  // the leading comma is intentional so empty string "" is also included
  ",key,ref,ref_for,ref_key,onVnodeBeforeMount,onVnodeMounted,onVnodeBeforeUpdate,onVnodeUpdated,onVnodeBeforeUnmount,onVnodeUnmounted"
), bs = (e) => {
  const t = /* @__PURE__ */ Object.create(null);
  return ((n) => t[n] || (t[n] = e(n)));
}, Ql = /-\w/g, ot = bs(
  (e) => e.replace(Ql, (t) => t.slice(1).toUpperCase())
), zl = /\B([A-Z])/g, en = bs(
  (e) => e.replace(zl, "-$1").toLowerCase()
), Oi = bs((e) => e.charAt(0).toUpperCase() + e.slice(1)), Ls = bs(
  (e) => e ? `on${Oi(e)}` : ""
), _t = (e, t) => !Object.is(e, t), Ns = (e, ...t) => {
  for (let n = 0; n < e.length; n++)
    e[n](...t);
}, Di = (e, t, n, s = !1) => {
  Object.defineProperty(e, t, {
    configurable: !0,
    enumerable: !1,
    writable: s,
    value: n
  });
}, Gl = (e) => {
  const t = parseFloat(e);
  return isNaN(t) ? e : t;
}, Yl = (e) => {
  const t = we(e) ? Number(e) : NaN;
  return isNaN(t) ? e : t;
};
let Uo;
const xs = () => Uo || (Uo = typeof globalThis < "u" ? globalThis : typeof self < "u" ? self : typeof window < "u" ? window : typeof globalThis < "u" ? globalThis : {});
function Pt(e) {
  if (Q(e)) {
    const t = {};
    for (let n = 0; n < e.length; n++) {
      const s = e[n], o = we(s) ? ea(s) : Pt(s);
      if (o)
        for (const i in o)
          t[i] = o[i];
    }
    return t;
  } else if (we(e) || le(e))
    return e;
}
const Xl = /;(?![^(]*\))/g, Jl = /:([^]+)/, Zl = /\/\*[^]*?\*\//g;
function ea(e) {
  const t = {};
  return e.replace(Zl, "").split(Xl).forEach((n) => {
    if (n) {
      const s = n.split(Jl);
      s.length > 1 && (t[s[0].trim()] = s[1].trim());
    }
  }), t;
}
function j(e) {
  let t = "";
  if (we(e))
    t = e;
  else if (Q(e))
    for (let n = 0; n < e.length; n++) {
      const s = j(e[n]);
      s && (t += s + " ");
    }
  else if (le(e))
    for (const n in e)
      e[n] && (t += n + " ");
  return t.trim();
}
const ta = "itemscope,allowfullscreen,formnovalidate,ismap,nomodule,novalidate,readonly", na = /* @__PURE__ */ co(ta);
function $i(e) {
  return !!e || e === "";
}
function sa(e, t) {
  if (e.length !== t.length) return !1;
  let n = !0;
  for (let s = 0; n && s < e.length; s++)
    n = po(e[s], t[s]);
  return n;
}
function po(e, t) {
  if (e === t) return !0;
  let n = qo(e), s = qo(t);
  if (n || s)
    return n && s ? e.getTime() === t.getTime() : !1;
  if (n = St(e), s = St(t), n || s)
    return e === t;
  if (n = Q(e), s = Q(t), n || s)
    return n && s ? sa(e, t) : !1;
  if (n = le(e), s = le(t), n || s) {
    if (!n || !s)
      return !1;
    const o = Object.keys(e).length, i = Object.keys(t).length;
    if (o !== i)
      return !1;
    for (const l in e) {
      const c = e.hasOwnProperty(l), u = t.hasOwnProperty(l);
      if (c && !u || !c && u || !po(e[l], t[l]))
        return !1;
    }
  }
  return String(e) === String(t);
}
const Fi = (e) => !!(e && e.__v_isRef === !0), y = (e) => we(e) ? e : e == null ? "" : Q(e) || le(e) && (e.toString === Li || !Y(e.toString)) ? Fi(e) ? y(e.value) : JSON.stringify(e, Hi, 2) : String(e), Hi = (e, t) => Fi(t) ? Hi(e, t.value) : pn(t) ? {
  [`Map(${t.size})`]: [...t.entries()].reduce(
    (n, [s, o], i) => (n[Os(s, i) + " =>"] = o, n),
    {}
  )
} : Ii(t) ? {
  [`Set(${t.size})`]: [...t.values()].map((n) => Os(n))
} : St(t) ? Os(t) : le(t) && !Q(t) && !Ni(t) ? String(t) : t, Os = (e, t = "") => {
  var n;
  return (
    // Symbol.description in es2019+ so we need to cast here to pass
    // the lib: es2016 check
    St(e) ? `Symbol(${(n = e.description) != null ? n : t})` : e
  );
};
let Le;
class oa {
  // TODO isolatedDeclarations "__v_skip"
  constructor(t = !1) {
    this.detached = t, this._active = !0, this._on = 0, this.effects = [], this.cleanups = [], this._isPaused = !1, this._warnOnRun = !0, this.__v_skip = !0, !t && Le && (Le.active ? (this.parent = Le, this.index = (Le.scopes || (Le.scopes = [])).push(
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
      const n = Le;
      try {
        return Le = this, t();
      } finally {
        Le = n;
      }
    }
  }
  /**
   * This should only be called on non-detached scopes
   * @internal
   */
  on() {
    ++this._on === 1 && (this.prevScope = Le, Le = this);
  }
  /**
   * This should only be called on non-detached scopes
   * @internal
   */
  off() {
    if (this._on > 0 && --this._on === 0) {
      if (Le === this)
        Le = this.prevScope;
      else {
        let t = Le;
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
        const o = this.parent.scopes.pop();
        o && o !== this && (this.parent.scopes[this.index] = o, o.index = this.index);
      }
      this.parent = void 0;
    }
  }
}
function ia() {
  return Le;
}
let me;
const Ds = /* @__PURE__ */ new WeakSet();
class Bi {
  constructor(t) {
    this.fn = t, this.deps = void 0, this.depsTail = void 0, this.flags = 5, this.next = void 0, this.cleanup = void 0, this.scheduler = void 0, Le && (Le.active ? Le.effects.push(this) : this.flags &= -2);
  }
  pause() {
    this.flags |= 64;
  }
  resume() {
    this.flags & 64 && (this.flags &= -65, Ds.has(this) && (Ds.delete(this), this.trigger()));
  }
  /**
   * @internal
   */
  notify() {
    this.flags & 2 && !(this.flags & 32) || this.flags & 8 || Vi(this);
  }
  run() {
    if (!(this.flags & 1))
      return this.fn();
    this.flags |= 2, Ko(this), qi(this);
    const t = me, n = it;
    me = this, it = !0;
    try {
      return this.fn();
    } finally {
      Ui(this), me = t, it = n, this.flags &= -3;
    }
  }
  stop() {
    if (this.flags & 1) {
      for (let t = this.deps; t; t = t.nextDep)
        ho(t);
      this.deps = this.depsTail = void 0, Ko(this), this.onStop && this.onStop(), this.flags &= -2;
    }
  }
  trigger() {
    this.flags & 64 ? Ds.add(this) : this.scheduler ? this.scheduler() : this.runIfDirty();
  }
  /**
   * @internal
   */
  runIfDirty() {
    zs(this) && this.run();
  }
  get dirty() {
    return zs(this);
  }
}
let ji = 0, Rn, Ln;
function Vi(e, t = !1) {
  if (e.flags |= 8, t) {
    e.next = Ln, Ln = e;
    return;
  }
  e.next = Rn, Rn = e;
}
function vo() {
  ji++;
}
function go() {
  if (--ji > 0)
    return;
  if (Ln) {
    let t = Ln;
    for (Ln = void 0; t; ) {
      const n = t.next;
      t.next = void 0, t.flags &= -9, t = n;
    }
  }
  let e;
  for (; Rn; ) {
    let t = Rn;
    for (Rn = void 0; t; ) {
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
function qi(e) {
  for (let t = e.deps; t; t = t.nextDep)
    t.version = -1, t.prevActiveLink = t.dep.activeLink, t.dep.activeLink = t;
}
function Ui(e) {
  let t, n = e.depsTail, s = n;
  for (; s; ) {
    const o = s.prevDep;
    s.version === -1 ? (s === n && (n = o), ho(s), ra(s)) : t = s, s.dep.activeLink = s.prevActiveLink, s.prevActiveLink = void 0, s = o;
  }
  e.deps = t, e.depsTail = n;
}
function zs(e) {
  for (let t = e.deps; t; t = t.nextDep)
    if (t.dep.version !== t.version || t.dep.computed && (Ki(t.dep.computed) || t.dep.version !== t.version))
      return !0;
  return !!e._dirty;
}
function Ki(e) {
  if (e.flags & 4 && !(e.flags & 16) || (e.flags &= -17, e.globalVersion === Hn) || (e.globalVersion = Hn, !e.isSSR && e.flags & 128 && (!e.deps && !e._dirty || !zs(e))))
    return;
  e.flags |= 2;
  const t = e.dep, n = me, s = it;
  me = e, it = !0;
  try {
    qi(e);
    const o = e.fn(e._value);
    (t.version === 0 || _t(o, e._value)) && (e.flags |= 128, e._value = o, t.version++);
  } catch (o) {
    throw t.version++, o;
  } finally {
    me = n, it = s, Ui(e), e.flags &= -3;
  }
}
function ho(e, t = !1) {
  const { dep: n, prevSub: s, nextSub: o } = e;
  if (s && (s.nextSub = o, e.prevSub = void 0), o && (o.prevSub = s, e.nextSub = void 0), n.subs === e && (n.subs = s, !s && n.computed)) {
    n.computed.flags &= -5;
    for (let i = n.computed.deps; i; i = i.nextDep)
      ho(i, !0);
  }
  !t && !--n.sc && n.map && n.map.delete(n.key);
}
function ra(e) {
  const { prevDep: t, nextDep: n } = e;
  t && (t.nextDep = n, e.prevDep = void 0), n && (n.prevDep = t, e.nextDep = void 0);
}
let it = !0;
const Wi = [];
function Rt() {
  Wi.push(it), it = !1;
}
function Lt() {
  const e = Wi.pop();
  it = e === void 0 ? !0 : e;
}
function Ko(e) {
  const { cleanup: t } = e;
  if (e.cleanup = void 0, t) {
    const n = me;
    me = void 0;
    try {
      t();
    } finally {
      me = n;
    }
  }
}
let Hn = 0;
class la {
  constructor(t, n) {
    this.sub = t, this.dep = n, this.version = n.version, this.nextDep = this.prevDep = this.nextSub = this.prevSub = this.prevActiveLink = void 0;
  }
}
class mo {
  // TODO isolatedDeclarations "__v_skip"
  constructor(t) {
    this.computed = t, this.version = 0, this.activeLink = void 0, this.subs = void 0, this.map = void 0, this.key = void 0, this.sc = 0, this.__v_skip = !0;
  }
  track(t) {
    if (!me || !it || me === this.computed)
      return;
    let n = this.activeLink;
    if (n === void 0 || n.sub !== me)
      n = this.activeLink = new la(me, this), me.deps ? (n.prevDep = me.depsTail, me.depsTail.nextDep = n, me.depsTail = n) : me.deps = me.depsTail = n, Qi(n);
    else if (n.version === -1 && (n.version = this.version, n.nextDep)) {
      const s = n.nextDep;
      s.prevDep = n.prevDep, n.prevDep && (n.prevDep.nextDep = s), n.prevDep = me.depsTail, n.nextDep = void 0, me.depsTail.nextDep = n, me.depsTail = n, me.deps === n && (me.deps = s);
    }
    return n;
  }
  trigger(t) {
    this.version++, Hn++, this.notify(t);
  }
  notify(t) {
    vo();
    try {
      for (let n = this.subs; n; n = n.prevSub)
        n.sub.notify() && n.sub.dep.notify();
    } finally {
      go();
    }
  }
}
function Qi(e) {
  if (e.dep.sc++, e.sub.flags & 4) {
    const t = e.dep.computed;
    if (t && !e.dep.subs) {
      t.flags |= 20;
      for (let s = t.deps; s; s = s.nextDep)
        Qi(s);
    }
    const n = e.dep.subs;
    n !== e && (e.prevSub = n, n && (n.nextSub = e)), e.dep.subs = e;
  }
}
const Gs = /* @__PURE__ */ new WeakMap(), Jt = /* @__PURE__ */ Symbol(
  ""
), Ys = /* @__PURE__ */ Symbol(
  ""
), Bn = /* @__PURE__ */ Symbol(
  ""
);
function De(e, t, n) {
  if (it && me) {
    let s = Gs.get(e);
    s || Gs.set(e, s = /* @__PURE__ */ new Map());
    let o = s.get(n);
    o || (s.set(n, o = new mo()), o.map = s, o.key = n), o.track();
  }
}
function Tt(e, t, n, s, o, i) {
  const l = Gs.get(e);
  if (!l) {
    Hn++;
    return;
  }
  const c = (u) => {
    u && u.trigger();
  };
  if (vo(), t === "clear")
    l.forEach(c);
  else {
    const u = Q(e), g = u && fo(n);
    if (u && n === "length") {
      const p = Number(s);
      l.forEach((m, k) => {
        (k === "length" || k === Bn || !St(k) && k >= p) && c(m);
      });
    } else
      switch ((n !== void 0 || l.has(void 0)) && c(l.get(n)), g && c(l.get(Bn)), t) {
        case "add":
          u ? g && c(l.get("length")) : (c(l.get(Jt)), pn(e) && c(l.get(Ys)));
          break;
        case "delete":
          u || (c(l.get(Jt)), pn(e) && c(l.get(Ys)));
          break;
        case "set":
          pn(e) && c(l.get(Jt));
          break;
      }
  }
  go();
}
function an(e) {
  const t = /* @__PURE__ */ oe(e);
  return t === e ? t : (De(t, "iterate", Bn), /* @__PURE__ */ Je(e) ? t : t.map(rt));
}
function Ss(e) {
  return De(e = /* @__PURE__ */ oe(e), "iterate", Bn), e;
}
function ht(e, t) {
  return /* @__PURE__ */ Nt(e) ? mn(/* @__PURE__ */ Zt(e) ? rt(t) : t) : rt(t);
}
const aa = {
  __proto__: null,
  [Symbol.iterator]() {
    return $s(this, Symbol.iterator, (e) => ht(this, e));
  },
  concat(...e) {
    return an(this).concat(
      ...e.map((t) => Q(t) ? an(t) : t)
    );
  },
  entries() {
    return $s(this, "entries", (e) => (e[1] = ht(this, e[1]), e));
  },
  every(e, t) {
    return Ct(this, "every", e, t, void 0, arguments);
  },
  filter(e, t) {
    return Ct(
      this,
      "filter",
      e,
      t,
      (n) => n.map((s) => ht(this, s)),
      arguments
    );
  },
  find(e, t) {
    return Ct(
      this,
      "find",
      e,
      t,
      (n) => ht(this, n),
      arguments
    );
  },
  findIndex(e, t) {
    return Ct(this, "findIndex", e, t, void 0, arguments);
  },
  findLast(e, t) {
    return Ct(
      this,
      "findLast",
      e,
      t,
      (n) => ht(this, n),
      arguments
    );
  },
  findLastIndex(e, t) {
    return Ct(this, "findLastIndex", e, t, void 0, arguments);
  },
  // flat, flatMap could benefit from ARRAY_ITERATE but are not straight-forward to implement
  forEach(e, t) {
    return Ct(this, "forEach", e, t, void 0, arguments);
  },
  includes(...e) {
    return Fs(this, "includes", e);
  },
  indexOf(...e) {
    return Fs(this, "indexOf", e);
  },
  join(e) {
    return an(this).join(e);
  },
  // keys() iterator only reads `length`, no optimization required
  lastIndexOf(...e) {
    return Fs(this, "lastIndexOf", e);
  },
  map(e, t) {
    return Ct(this, "map", e, t, void 0, arguments);
  },
  pop() {
    return wn(this, "pop");
  },
  push(...e) {
    return wn(this, "push", e);
  },
  reduce(e, ...t) {
    return Wo(this, "reduce", e, t);
  },
  reduceRight(e, ...t) {
    return Wo(this, "reduceRight", e, t);
  },
  shift() {
    return wn(this, "shift");
  },
  // slice could use ARRAY_ITERATE but also seems to beg for range tracking
  some(e, t) {
    return Ct(this, "some", e, t, void 0, arguments);
  },
  splice(...e) {
    return wn(this, "splice", e);
  },
  toReversed() {
    return an(this).toReversed();
  },
  toSorted(e) {
    return an(this).toSorted(e);
  },
  toSpliced(...e) {
    return an(this).toSpliced(...e);
  },
  unshift(...e) {
    return wn(this, "unshift", e);
  },
  values() {
    return $s(this, "values", (e) => ht(this, e));
  }
};
function $s(e, t, n) {
  const s = Ss(e), o = s[t]();
  return s !== e && !/* @__PURE__ */ Je(e) && (o._next = o.next, o.next = () => {
    const i = o._next();
    return i.done || (i.value = n(i.value)), i;
  }), o;
}
const ca = Array.prototype;
function Ct(e, t, n, s, o, i) {
  const l = Ss(e), c = l !== e && !/* @__PURE__ */ Je(e), u = l[t];
  if (u !== ca[t]) {
    const m = u.apply(e, i);
    return c ? rt(m) : m;
  }
  let g = n;
  l !== e && (c ? g = function(m, k) {
    return n.call(this, ht(e, m), k, e);
  } : n.length > 2 && (g = function(m, k) {
    return n.call(this, m, k, e);
  }));
  const p = u.call(l, g, s);
  return c && o ? o(p) : p;
}
function Wo(e, t, n, s) {
  const o = Ss(e), i = o !== e && !/* @__PURE__ */ Je(e);
  let l = n, c = !1;
  o !== e && (i ? (c = s.length === 0, l = function(g, p, m) {
    return c && (c = !1, g = ht(e, g)), n.call(this, g, ht(e, p), m, e);
  }) : n.length > 3 && (l = function(g, p, m) {
    return n.call(this, g, p, m, e);
  }));
  const u = o[t](l, ...s);
  return c ? ht(e, u) : u;
}
function Fs(e, t, n) {
  const s = /* @__PURE__ */ oe(e);
  De(s, "iterate", Bn);
  const o = s[t](...n);
  return (o === -1 || o === !1) && /* @__PURE__ */ xo(n[0]) ? (n[0] = /* @__PURE__ */ oe(n[0]), s[t](...n)) : o;
}
function wn(e, t, n = []) {
  Rt(), vo();
  const s = (/* @__PURE__ */ oe(e))[t].apply(e, n);
  return go(), Lt(), s;
}
const ua = /* @__PURE__ */ co("__proto__,__v_isRef,__isVue"), zi = new Set(
  /* @__PURE__ */ Object.getOwnPropertyNames(Symbol).filter((e) => e !== "arguments" && e !== "caller").map((e) => Symbol[e]).filter(St)
);
function fa(e) {
  St(e) || (e = String(e));
  const t = /* @__PURE__ */ oe(this);
  return De(t, "has", e), t.hasOwnProperty(e);
}
class Gi {
  constructor(t = !1, n = !1) {
    this._isReadonly = t, this._isShallow = n;
  }
  get(t, n, s) {
    if (n === "__v_skip") return t.__v_skip;
    const o = this._isReadonly, i = this._isShallow;
    if (n === "__v_isReactive")
      return !o;
    if (n === "__v_isReadonly")
      return o;
    if (n === "__v_isShallow")
      return i;
    if (n === "__v_raw")
      return s === (o ? i ? xa : Zi : i ? Ji : Xi).get(t) || // receiver is not the reactive proxy, but has the same prototype
      // this means the receiver is a user proxy of the reactive proxy
      Object.getPrototypeOf(t) === Object.getPrototypeOf(s) ? t : void 0;
    const l = Q(t);
    if (!o) {
      let u;
      if (l && (u = aa[n]))
        return u;
      if (n === "hasOwnProperty")
        return fa;
    }
    const c = Reflect.get(
      t,
      n,
      // if this is a proxy wrapping a ref, return methods using the raw ref
      // as receiver so that we don't have to call `toRaw` on the ref in all
      // its class methods
      /* @__PURE__ */ $e(t) ? t : s
    );
    if ((St(n) ? zi.has(n) : ua(n)) || (o || De(t, "get", n), i))
      return c;
    if (/* @__PURE__ */ $e(c)) {
      const u = l && fo(n) ? c : c.value;
      return o && le(u) ? /* @__PURE__ */ Js(u) : u;
    }
    return le(c) ? o ? /* @__PURE__ */ Js(c) : /* @__PURE__ */ _o(c) : c;
  }
}
class Yi extends Gi {
  constructor(t = !1) {
    super(!1, t);
  }
  set(t, n, s, o) {
    let i = t[n];
    const l = Q(t) && fo(n);
    if (!this._isShallow) {
      const g = /* @__PURE__ */ Nt(i);
      if (!/* @__PURE__ */ Je(s) && !/* @__PURE__ */ Nt(s) && (i = /* @__PURE__ */ oe(i), s = /* @__PURE__ */ oe(s)), !l && /* @__PURE__ */ $e(i) && !/* @__PURE__ */ $e(s))
        return g || (i.value = s), !0;
    }
    const c = l ? Number(n) < t.length : re(t, n), u = Reflect.set(
      t,
      n,
      s,
      /* @__PURE__ */ $e(t) ? t : o
    );
    return t === /* @__PURE__ */ oe(o) && (c ? _t(s, i) && Tt(t, "set", n, s) : Tt(t, "add", n, s)), u;
  }
  deleteProperty(t, n) {
    const s = re(t, n);
    t[n];
    const o = Reflect.deleteProperty(t, n);
    return o && s && Tt(t, "delete", n, void 0), o;
  }
  has(t, n) {
    const s = Reflect.has(t, n);
    return (!St(n) || !zi.has(n)) && De(t, "has", n), s;
  }
  ownKeys(t) {
    return De(
      t,
      "iterate",
      Q(t) ? "length" : Jt
    ), Reflect.ownKeys(t);
  }
}
class da extends Gi {
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
const pa = /* @__PURE__ */ new Yi(), va = /* @__PURE__ */ new da(), ga = /* @__PURE__ */ new Yi(!0);
const Xs = (e) => e, ss = (e) => Reflect.getPrototypeOf(e);
function ha(e, t, n) {
  return function(...s) {
    const o = this.__v_raw, i = /* @__PURE__ */ oe(o), l = pn(i), c = e === "entries" || e === Symbol.iterator && l, u = e === "keys" && l, g = o[e](...s), p = n ? Xs : t ? mn : rt;
    return !t && De(
      i,
      "iterate",
      u ? Ys : Jt
    ), Ee(
      // inheriting all iterator properties
      Object.create(g),
      {
        // iterator protocol
        next() {
          const { value: m, done: k } = g.next();
          return k ? { value: m, done: k } : {
            value: c ? [p(m[0]), p(m[1])] : p(m),
            done: k
          };
        }
      }
    );
  };
}
function os(e) {
  return function(...t) {
    return e === "delete" ? !1 : e === "clear" ? void 0 : this;
  };
}
function ma(e, t) {
  const n = {
    get(o) {
      const i = this.__v_raw, l = /* @__PURE__ */ oe(i), c = /* @__PURE__ */ oe(o);
      e || (_t(o, c) && De(l, "get", o), De(l, "get", c));
      const { has: u } = ss(l), g = t ? Xs : e ? mn : rt;
      if (u.call(l, o))
        return g(i.get(o));
      if (u.call(l, c))
        return g(i.get(c));
      i !== l && i.get(o);
    },
    get size() {
      const o = this.__v_raw;
      return !e && De(/* @__PURE__ */ oe(o), "iterate", Jt), o.size;
    },
    has(o) {
      const i = this.__v_raw, l = /* @__PURE__ */ oe(i), c = /* @__PURE__ */ oe(o);
      return e || (_t(o, c) && De(l, "has", o), De(l, "has", c)), o === c ? i.has(o) : i.has(o) || i.has(c);
    },
    forEach(o, i) {
      const l = this, c = l.__v_raw, u = /* @__PURE__ */ oe(c), g = t ? Xs : e ? mn : rt;
      return !e && De(u, "iterate", Jt), c.forEach((p, m) => o.call(i, g(p), g(m), l));
    }
  };
  return Ee(
    n,
    e ? {
      add: os("add"),
      set: os("set"),
      delete: os("delete"),
      clear: os("clear")
    } : {
      add(o) {
        const i = /* @__PURE__ */ oe(this), l = ss(i), c = /* @__PURE__ */ oe(o), u = !t && !/* @__PURE__ */ Je(o) && !/* @__PURE__ */ Nt(o) ? c : o;
        return l.has.call(i, u) || _t(o, u) && l.has.call(i, o) || _t(c, u) && l.has.call(i, c) || (i.add(u), Tt(i, "add", u, u)), this;
      },
      set(o, i) {
        !t && !/* @__PURE__ */ Je(i) && !/* @__PURE__ */ Nt(i) && (i = /* @__PURE__ */ oe(i));
        const l = /* @__PURE__ */ oe(this), { has: c, get: u } = ss(l);
        let g = c.call(l, o);
        g || (o = /* @__PURE__ */ oe(o), g = c.call(l, o));
        const p = u.call(l, o);
        return l.set(o, i), g ? _t(i, p) && Tt(l, "set", o, i) : Tt(l, "add", o, i), this;
      },
      delete(o) {
        const i = /* @__PURE__ */ oe(this), { has: l, get: c } = ss(i);
        let u = l.call(i, o);
        u || (o = /* @__PURE__ */ oe(o), u = l.call(i, o)), c && c.call(i, o);
        const g = i.delete(o);
        return u && Tt(i, "delete", o, void 0), g;
      },
      clear() {
        const o = /* @__PURE__ */ oe(this), i = o.size !== 0, l = o.clear();
        return i && Tt(
          o,
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
  ].forEach((o) => {
    n[o] = ha(o, e, t);
  }), n;
}
function yo(e, t) {
  const n = ma(e, t);
  return (s, o, i) => o === "__v_isReactive" ? !e : o === "__v_isReadonly" ? e : o === "__v_raw" ? s : Reflect.get(
    re(n, o) && o in s ? n : s,
    o,
    i
  );
}
const ya = {
  get: /* @__PURE__ */ yo(!1, !1)
}, _a = {
  get: /* @__PURE__ */ yo(!1, !0)
}, ba = {
  get: /* @__PURE__ */ yo(!0, !1)
};
const Xi = /* @__PURE__ */ new WeakMap(), Ji = /* @__PURE__ */ new WeakMap(), Zi = /* @__PURE__ */ new WeakMap(), xa = /* @__PURE__ */ new WeakMap();
function Sa(e) {
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
function Ca(e) {
  return e.__v_skip || !Object.isExtensible(e) ? 0 : Sa(Wl(e));
}
// @__NO_SIDE_EFFECTS__
function _o(e) {
  return /* @__PURE__ */ Nt(e) ? e : bo(
    e,
    !1,
    pa,
    ya,
    Xi
  );
}
// @__NO_SIDE_EFFECTS__
function wa(e) {
  return bo(
    e,
    !1,
    ga,
    _a,
    Ji
  );
}
// @__NO_SIDE_EFFECTS__
function Js(e) {
  return bo(
    e,
    !0,
    va,
    ba,
    Zi
  );
}
function bo(e, t, n, s, o) {
  if (!le(e) || e.__v_raw && !(t && e.__v_isReactive))
    return e;
  const i = Ca(e);
  if (i === 0)
    return e;
  const l = o.get(e);
  if (l)
    return l;
  const c = new Proxy(
    e,
    i === 2 ? s : n
  );
  return o.set(e, c), c;
}
// @__NO_SIDE_EFFECTS__
function Zt(e) {
  return /* @__PURE__ */ Nt(e) ? /* @__PURE__ */ Zt(e.__v_raw) : !!(e && e.__v_isReactive);
}
// @__NO_SIDE_EFFECTS__
function Nt(e) {
  return !!(e && e.__v_isReadonly);
}
// @__NO_SIDE_EFFECTS__
function Je(e) {
  return !!(e && e.__v_isShallow);
}
// @__NO_SIDE_EFFECTS__
function xo(e) {
  return e ? !!e.__v_raw : !1;
}
// @__NO_SIDE_EFFECTS__
function oe(e) {
  const t = e && e.__v_raw;
  return t ? /* @__PURE__ */ oe(t) : e;
}
function ka(e) {
  return !re(e, "__v_skip") && Object.isExtensible(e) && Di(e, "__v_skip", !0), e;
}
const rt = (e) => le(e) ? /* @__PURE__ */ _o(e) : e, mn = (e) => le(e) ? /* @__PURE__ */ Js(e) : e;
// @__NO_SIDE_EFFECTS__
function $e(e) {
  return e ? e.__v_isRef === !0 : !1;
}
// @__NO_SIDE_EFFECTS__
function Se(e) {
  return Aa(e, !1);
}
function Aa(e, t) {
  return /* @__PURE__ */ $e(e) ? e : new Pa(e, t);
}
class Pa {
  constructor(t, n) {
    this.dep = new mo(), this.__v_isRef = !0, this.__v_isShallow = !1, this._rawValue = n ? t : /* @__PURE__ */ oe(t), this._value = n ? t : rt(t), this.__v_isShallow = n;
  }
  get value() {
    return this.dep.track(), this._value;
  }
  set value(t) {
    const n = this._rawValue, s = this.__v_isShallow || /* @__PURE__ */ Je(t) || /* @__PURE__ */ Nt(t);
    t = s ? t : /* @__PURE__ */ oe(t), _t(t, n) && (this._rawValue = t, this._value = s ? t : rt(t), this.dep.trigger());
  }
}
function Ma(e) {
  return /* @__PURE__ */ $e(e) ? e.value : e;
}
const Ta = {
  get: (e, t, n) => t === "__v_raw" ? e : Ma(Reflect.get(e, t, n)),
  set: (e, t, n, s) => {
    const o = e[t];
    return /* @__PURE__ */ $e(o) && !/* @__PURE__ */ $e(n) ? (o.value = n, !0) : Reflect.set(e, t, n, s);
  }
};
function er(e) {
  return /* @__PURE__ */ Zt(e) ? e : new Proxy(e, Ta);
}
class Ea {
  constructor(t, n, s) {
    this.fn = t, this.setter = n, this._value = void 0, this.dep = new mo(this), this.__v_isRef = !0, this.deps = void 0, this.depsTail = void 0, this.flags = 16, this.globalVersion = Hn - 1, this.next = void 0, this.effect = this, this.__v_isReadonly = !n, this.isSSR = s;
  }
  /**
   * @internal
   */
  notify() {
    if (this.flags |= 16, !(this.flags & 8) && // avoid infinite self recursion
    me !== this)
      return Vi(this, !0), !0;
  }
  get value() {
    const t = this.dep.track();
    return Ki(this), t && (t.version = this.dep.version), this._value;
  }
  set value(t) {
    this.setter && this.setter(t);
  }
}
// @__NO_SIDE_EFFECTS__
function Ia(e, t, n = !1) {
  let s, o;
  return Y(e) ? s = e : (s = e.get, o = e.set), new Ea(s, o, n);
}
const is = {}, as = /* @__PURE__ */ new WeakMap();
let zt;
function Ra(e, t = !1, n = zt) {
  if (n) {
    let s = as.get(n);
    s || as.set(n, s = []), s.push(e);
  }
}
function La(e, t, n = ve) {
  const { immediate: s, deep: o, once: i, scheduler: l, augmentJob: c, call: u } = n, g = (H) => o ? H : /* @__PURE__ */ Je(H) || o === !1 || o === 0 ? Et(H, 1) : Et(H);
  let p, m, k, T, $ = !1, M = !1;
  if (/* @__PURE__ */ $e(e) ? (m = () => e.value, $ = /* @__PURE__ */ Je(e)) : /* @__PURE__ */ Zt(e) ? (m = () => g(e), $ = !0) : Q(e) ? (M = !0, $ = e.some((H) => /* @__PURE__ */ Zt(H) || /* @__PURE__ */ Je(H)), m = () => e.map((H) => {
    if (/* @__PURE__ */ $e(H))
      return H.value;
    if (/* @__PURE__ */ Zt(H))
      return g(H);
    if (Y(H))
      return u ? u(H, 2) : H();
  })) : Y(e) ? t ? m = u ? () => u(e, 2) : e : m = () => {
    if (k) {
      Rt();
      try {
        k();
      } finally {
        Lt();
      }
    }
    const H = zt;
    zt = p;
    try {
      return u ? u(e, 3, [T]) : e(T);
    } finally {
      zt = H;
    }
  } : m = xt, t && o) {
    const H = m, se = o === !0 ? 1 / 0 : o;
    m = () => Et(H(), se);
  }
  const K = ia(), X = () => {
    p.stop(), K && K.active && uo(K.effects, p);
  };
  if (i && t) {
    const H = t;
    t = (...se) => {
      H(...se), X();
    };
  }
  let z = M ? new Array(e.length).fill(is) : is;
  const F = (H) => {
    if (!(!(p.flags & 1) || !p.dirty && !H))
      if (t) {
        const se = p.run();
        if (o || $ || (M ? se.some((be, ae) => _t(be, z[ae])) : _t(se, z))) {
          k && k();
          const be = zt;
          zt = p;
          try {
            const ae = [
              se,
              // pass undefined as the old value when it's changed for the first time
              z === is ? void 0 : M && z[0] === is ? [] : z,
              T
            ];
            z = se, u ? u(t, 3, ae) : (
              // @ts-expect-error
              t(...ae)
            );
          } finally {
            zt = be;
          }
        }
      } else
        p.run();
  };
  return c && c(F), p = new Bi(m), p.scheduler = l ? () => l(F, !1) : F, T = (H) => Ra(H, !1, p), k = p.onStop = () => {
    const H = as.get(p);
    if (H) {
      if (u)
        u(H, 4);
      else
        for (const se of H) se();
      as.delete(p);
    }
  }, t ? s ? F(!0) : z = p.run() : l ? l(F.bind(null, !0), !0) : p.run(), X.pause = p.pause.bind(p), X.resume = p.resume.bind(p), X.stop = X, X;
}
function Et(e, t = 1 / 0, n) {
  if (t <= 0 || !le(e) || e.__v_skip || (n = n || /* @__PURE__ */ new Map(), (n.get(e) || 0) >= t))
    return e;
  if (n.set(e, t), t--, /* @__PURE__ */ $e(e))
    Et(e.value, t, n);
  else if (Q(e))
    for (let s = 0; s < e.length; s++)
      Et(e[s], t, n);
  else if (Ii(e) || pn(e))
    e.forEach((s) => {
      Et(s, t, n);
    });
  else if (Ni(e)) {
    for (const s in e)
      Et(e[s], t, n);
    for (const s of Object.getOwnPropertySymbols(e))
      Object.prototype.propertyIsEnumerable.call(e, s) && Et(e[s], t, n);
  }
  return e;
}
function Qn(e, t, n, s) {
  try {
    return s ? e(...s) : e();
  } catch (o) {
    Cs(o, t, n);
  }
}
function lt(e, t, n, s) {
  if (Y(e)) {
    const o = Qn(e, t, n, s);
    return o && Ri(o) && o.catch((i) => {
      Cs(i, t, n);
    }), o;
  }
  if (Q(e)) {
    const o = [];
    for (let i = 0; i < e.length; i++)
      o.push(lt(e[i], t, n, s));
    return o;
  }
}
function Cs(e, t, n, s = !0) {
  const o = t ? t.vnode : null, { errorHandler: i, throwUnhandledErrorInProduction: l } = t && t.appContext.config || ve;
  if (t) {
    let c = t.parent;
    const u = t.proxy, g = `https://vuejs.org/error-reference/#runtime-${n}`;
    for (; c; ) {
      const p = c.ec;
      if (p) {
        for (let m = 0; m < p.length; m++)
          if (p[m](e, u, g) === !1)
            return;
      }
      c = c.parent;
    }
    if (i) {
      Rt(), Qn(i, null, 10, [
        e,
        u,
        g
      ]), Lt();
      return;
    }
  }
  Na(e, n, o, s, l);
}
function Na(e, t, n, s = !0, o = !1) {
  if (o)
    throw e;
  console.error(e);
}
const Be = [];
let vt = -1;
const vn = [];
let Vt = null, fn = 0;
const tr = /* @__PURE__ */ Promise.resolve();
let cs = null;
function Gt(e) {
  const t = cs || tr;
  return e ? t.then(this ? e.bind(this) : e) : t;
}
function Oa(e) {
  let t = vt + 1, n = Be.length;
  for (; t < n; ) {
    const s = t + n >>> 1, o = Be[s], i = jn(o);
    i < e || i === e && o.flags & 2 ? t = s + 1 : n = s;
  }
  return t;
}
function So(e) {
  if (!(e.flags & 1)) {
    const t = jn(e), n = Be[Be.length - 1];
    !n || // fast path when the job id is larger than the tail
    !(e.flags & 2) && t >= jn(n) ? Be.push(e) : Be.splice(Oa(t), 0, e), e.flags |= 1, nr();
  }
}
function nr() {
  cs || (cs = tr.then(or));
}
function Da(e) {
  Q(e) ? vn.push(...e) : Vt && e.id === -1 ? Vt.splice(fn + 1, 0, e) : e.flags & 1 || (vn.push(e), e.flags |= 1), nr();
}
function Qo(e, t, n = vt + 1) {
  for (; n < Be.length; n++) {
    const s = Be[n];
    if (s && s.flags & 2) {
      if (e && s.id !== e.uid)
        continue;
      Be.splice(n, 1), n--, s.flags & 4 && (s.flags &= -2), s(), s.flags & 4 || (s.flags &= -2);
    }
  }
}
function sr(e) {
  if (vn.length) {
    const t = [...new Set(vn)].sort(
      (n, s) => jn(n) - jn(s)
    );
    if (vn.length = 0, Vt) {
      Vt.push(...t);
      return;
    }
    for (Vt = t, fn = 0; fn < Vt.length; fn++) {
      const n = Vt[fn];
      n.flags & 4 && (n.flags &= -2), n.flags & 8 || n(), n.flags &= -2;
    }
    Vt = null, fn = 0;
  }
}
const jn = (e) => e.id == null ? e.flags & 2 ? -1 : 1 / 0 : e.id;
function or(e) {
  try {
    for (vt = 0; vt < Be.length; vt++) {
      const t = Be[vt];
      t && !(t.flags & 8) && (t.flags & 4 && (t.flags &= -2), Qn(
        t,
        t.i,
        t.i ? 15 : 14
      ), t.flags & 4 || (t.flags &= -2));
    }
  } finally {
    for (; vt < Be.length; vt++) {
      const t = Be[vt];
      t && (t.flags &= -2);
    }
    vt = -1, Be.length = 0, sr(), cs = null, (Be.length || vn.length) && or();
  }
}
let Xe = null, ir = null;
function us(e) {
  const t = Xe;
  return Xe = e, ir = e && e.type.__scopeId || null, t;
}
function pt(e, t = Xe, n) {
  if (!t || e._n)
    return e;
  const s = (...o) => {
    s._d && ps(-1);
    const i = us(t);
    let l;
    try {
      l = e(...o);
    } finally {
      us(i), s._d && ps(1);
    }
    return l;
  };
  return s._n = !0, s._c = !0, s._d = !0, s;
}
function cn(e, t) {
  if (Xe === null)
    return e;
  const n = Ms(Xe), s = e.dirs || (e.dirs = []);
  for (let o = 0; o < t.length; o++) {
    let [i, l, c, u = ve] = t[o];
    i && (Y(i) && (i = {
      mounted: i,
      updated: i
    }), i.deep && Et(l), s.push({
      dir: i,
      instance: n,
      value: l,
      oldValue: void 0,
      arg: c,
      modifiers: u
    }));
  }
  return e;
}
function Ut(e, t, n, s) {
  const o = e.dirs, i = t && t.dirs;
  for (let l = 0; l < o.length; l++) {
    const c = o[l];
    i && (c.oldValue = i[l].value);
    let u = c.dir[s];
    u && (Rt(), lt(u, n, 8, [
      e.el,
      c,
      e,
      t
    ]), Lt());
  }
}
function $a(e, t) {
  if (Ve) {
    let n = Ve.provides;
    const s = Ve.parent && Ve.parent.provides;
    s === n && (n = Ve.provides = Object.create(s)), n[e] = t;
  }
}
function rs(e, t, n = !1) {
  const s = Dr();
  if (s || gn) {
    let o = gn ? gn._context.provides : s ? s.parent == null || s.ce ? s.vnode.appContext && s.vnode.appContext.provides : s.parent.provides : void 0;
    if (o && e in o)
      return o[e];
    if (arguments.length > 1)
      return n && Y(t) ? t.call(s && s.proxy) : t;
  }
}
const Fa = /* @__PURE__ */ Symbol.for("v-scx"), Ha = () => rs(Fa);
function Nn(e, t, n) {
  return rr(e, t, n);
}
function rr(e, t, n = ve) {
  const { immediate: s, deep: o, flush: i, once: l } = n, c = Ee({}, n), u = t && s || !t && i !== "post";
  let g;
  if (Un) {
    if (i === "sync") {
      const T = Ha();
      g = T.__watcherHandles || (T.__watcherHandles = []);
    } else if (!u) {
      const T = () => {
      };
      return T.stop = xt, T.resume = xt, T.pause = xt, T;
    }
  }
  const p = Ve;
  c.call = (T, $, M) => lt(T, p, $, M);
  let m = !1;
  i === "post" ? c.scheduler = (T) => {
    qe(T, p && p.suspense);
  } : i !== "sync" && (m = !0, c.scheduler = (T, $) => {
    $ ? T() : So(T);
  }), c.augmentJob = (T) => {
    t && (T.flags |= 4), m && (T.flags |= 2, p && (T.id = p.uid, T.i = p));
  };
  const k = La(e, t, c);
  return Un && (g ? g.push(k) : u && k()), k;
}
function Ba(e, t, n) {
  const s = this.proxy, o = we(e) ? e.includes(".") ? lr(s, e) : () => s[e] : e.bind(s, s);
  let i;
  Y(t) ? i = t : (i = t.handler, n = t);
  const l = zn(this), c = rr(o, i.bind(s), n);
  return l(), c;
}
function lr(e, t) {
  const n = t.split(".");
  return () => {
    let s = e;
    for (let o = 0; o < n.length && s; o++)
      s = s[n[o]];
    return s;
  };
}
const ja = /* @__PURE__ */ Symbol("_vte"), ar = (e) => e.__isTeleport, gt = /* @__PURE__ */ Symbol("_leaveCb"), kn = /* @__PURE__ */ Symbol("_enterCb");
function Va() {
  const e = {
    isMounted: !1,
    isLeaving: !1,
    isUnmounting: !1,
    leavingVNodes: /* @__PURE__ */ new Map()
  };
  return Co(() => {
    e.isMounted = !0;
  }), wo(() => {
    e.isUnmounting = !0;
  }), e;
}
const Ye = [Function, Array], cr = {
  mode: String,
  appear: Boolean,
  persisted: Boolean,
  // enter
  onBeforeEnter: Ye,
  onEnter: Ye,
  onAfterEnter: Ye,
  onEnterCancelled: Ye,
  // leave
  onBeforeLeave: Ye,
  onLeave: Ye,
  onAfterLeave: Ye,
  onLeaveCancelled: Ye,
  // appear
  onBeforeAppear: Ye,
  onAppear: Ye,
  onAfterAppear: Ye,
  onAppearCancelled: Ye
}, ur = (e) => {
  const t = e.subTree;
  return t.component ? ur(t.component) : t;
}, qa = {
  name: "BaseTransition",
  props: cr,
  setup(e, { slots: t }) {
    const n = Dr(), s = Va();
    return () => {
      const o = t.default && pr(t.default(), !0), i = o && o.length ? fr(o) : (
        // Keep explicit default-slot conditionals on the same transition path
        // as regular v-if branches, which render a comment placeholder.
        n.subTree ? B() : void 0
      );
      if (!i)
        return;
      const l = /* @__PURE__ */ oe(e), { mode: c } = l;
      if (s.isLeaving)
        return Hs(i);
      const u = zo(i);
      if (!u)
        return Hs(i);
      let g = Zs(
        u,
        l,
        s,
        n,
        // #11061, ensure enterHooks is fresh after clone
        (m) => g = m
      );
      u.type !== je && Vn(u, g);
      let p = n.subTree && zo(n.subTree);
      if (p && p.type !== je && !Yt(p, u) && ur(n).type !== je) {
        let m = Zs(
          p,
          l,
          s,
          n
        );
        if (Vn(p, m), c === "out-in" && u.type !== je)
          return s.isLeaving = !0, m.afterLeave = () => {
            s.isLeaving = !1, n.job.flags & 8 || n.update(), delete m.afterLeave, p = void 0;
          }, Hs(i);
        c === "in-out" && u.type !== je ? m.delayLeave = (k, T, $) => {
          const M = dr(
            s,
            p
          );
          M[String(p.key)] = p, k[gt] = () => {
            T(), k[gt] = void 0, delete g.delayedLeave, p = void 0;
          }, g.delayedLeave = () => {
            $(), delete g.delayedLeave, p = void 0;
          };
        } : p = void 0;
      } else p && (p = void 0);
      return i;
    };
  }
};
function fr(e) {
  let t = e[0];
  if (e.length > 1) {
    for (const n of e)
      if (n.type !== je) {
        t = n;
        break;
      }
  }
  return t;
}
const Ua = qa;
function dr(e, t) {
  const { leavingVNodes: n } = e;
  let s = n.get(t.type);
  return s || (s = /* @__PURE__ */ Object.create(null), n.set(t.type, s)), s;
}
function Zs(e, t, n, s, o) {
  const {
    appear: i,
    mode: l,
    persisted: c = !1,
    onBeforeEnter: u,
    onEnter: g,
    onAfterEnter: p,
    onEnterCancelled: m,
    onBeforeLeave: k,
    onLeave: T,
    onAfterLeave: $,
    onLeaveCancelled: M,
    onBeforeAppear: K,
    onAppear: X,
    onAfterAppear: z,
    onAppearCancelled: F
  } = t, H = String(e.key), se = dr(n, e), be = (G, ee) => {
    G && lt(
      G,
      s,
      9,
      ee
    );
  }, ae = (G, ee) => {
    const ye = ee[1];
    be(G, ee), Q(G) ? G.every((D) => D.length <= 1) && ye() : G.length <= 1 && ye();
  }, Ne = {
    mode: l,
    persisted: c,
    beforeEnter(G) {
      let ee = u;
      if (!n.isMounted)
        if (i)
          ee = K || u;
        else
          return;
      G[gt] && G[gt](
        !0
        /* cancelled */
      );
      const ye = se[H];
      ye && Yt(e, ye) && ye.el[gt] && ye.el[gt](), be(ee, [G]);
    },
    enter(G) {
      if (se[H] === e) return;
      let ee = g, ye = p, D = m;
      if (!n.isMounted)
        if (i)
          ee = X || g, ye = z || p, D = F || m;
        else
          return;
      let ge = !1;
      G[kn] = (Ze) => {
        ge || (ge = !0, Ze ? be(D, [G]) : be(ye, [G]), Ne.delayedLeave && Ne.delayedLeave(), G[kn] = void 0);
      };
      const Me = G[kn].bind(null, !1);
      ee ? ae(ee, [G, Me]) : Me();
    },
    leave(G, ee) {
      const ye = String(e.key);
      if (G[kn] && G[kn](
        !0
        /* cancelled */
      ), n.isUnmounting)
        return ee();
      be(k, [G]);
      let D = !1;
      G[gt] = (Me) => {
        D || (D = !0, ee(), Me ? be(M, [G]) : be($, [G]), G[gt] = void 0, se[ye] === e && delete se[ye]);
      };
      const ge = G[gt].bind(null, !1);
      se[ye] = e, T ? ae(T, [G, ge]) : ge();
    },
    clone(G) {
      const ee = Zs(
        G,
        t,
        n,
        s,
        o
      );
      return o && o(ee), ee;
    }
  };
  return Ne;
}
function Hs(e) {
  if (ws(e))
    return e = qt(e), e.children = null, e;
}
function zo(e) {
  if (!ws(e))
    return ar(e.type) && e.children ? fr(e.children) : e;
  if (e.component)
    return e.component.subTree;
  const { shapeFlag: t, children: n } = e;
  if (n) {
    if (t & 16)
      return n[0];
    if (t & 32 && Y(n.default))
      return n.default();
  }
}
function Vn(e, t) {
  e.shapeFlag & 6 && e.component ? (e.transition = t, Vn(e.component.subTree, t)) : e.shapeFlag & 128 ? (e.ssContent.transition = t.clone(e.ssContent), e.ssFallback.transition = t.clone(e.ssFallback)) : e.transition = t;
}
function pr(e, t = !1, n) {
  let s = [], o = 0;
  for (let i = 0; i < e.length; i++) {
    let l = e[i];
    const c = n == null ? l.key : String(n) + String(l.key != null ? l.key : i);
    l.type === de ? (l.patchFlag & 128 && o++, s = s.concat(
      pr(l.children, t, c)
    )) : (t || l.type !== je) && s.push(c != null ? qt(l, { key: c }) : l);
  }
  if (o > 1)
    for (let i = 0; i < s.length; i++)
      s[i].patchFlag = -2;
  return s;
}
function vr(e) {
  e.ids = [e.ids[0] + e.ids[2]++ + "-", 0, 0];
}
function Go(e, t) {
  let n;
  return !!((n = Object.getOwnPropertyDescriptor(e, t)) && !n.configurable);
}
const fs = /* @__PURE__ */ new WeakMap();
function On(e, t, n, s, o = !1) {
  if (Q(e)) {
    e.forEach(
      (M, K) => On(
        M,
        t && (Q(t) ? t[K] : t),
        n,
        s,
        o
      )
    );
    return;
  }
  if (Dn(s) && !o) {
    s.shapeFlag & 512 && s.type.__asyncResolved && s.component.subTree.component && On(e, t, n, s.component.subTree);
    return;
  }
  const i = s.shapeFlag & 4 ? Ms(s.component) : s.el, l = o ? null : i, { i: c, r: u } = e, g = t && t.r, p = c.refs === ve ? c.refs = {} : c.refs, m = c.setupState, k = /* @__PURE__ */ oe(m), T = m === ve ? Ei : (M) => Go(p, M) ? !1 : re(k, M), $ = (M, K) => !(K && Go(p, K));
  if (g != null && g !== u) {
    if (Yo(t), we(g))
      p[g] = null, T(g) && (m[g] = null);
    else if (/* @__PURE__ */ $e(g)) {
      const M = t;
      $(g, M.k) && (g.value = null), M.k && (p[M.k] = null);
    }
  }
  if (Y(u))
    Qn(u, c, 12, [l, p]);
  else {
    const M = we(u), K = /* @__PURE__ */ $e(u);
    if (M || K) {
      const X = () => {
        if (e.f) {
          const z = M ? T(u) ? m[u] : p[u] : $() || !e.k ? u.value : p[e.k];
          if (o)
            Q(z) && uo(z, i);
          else if (Q(z))
            z.includes(i) || z.push(i);
          else if (M)
            p[u] = [i], T(u) && (m[u] = p[u]);
          else {
            const F = [i];
            $(u, e.k) && (u.value = F), e.k && (p[e.k] = F);
          }
        } else M ? (p[u] = l, T(u) && (m[u] = l)) : K && ($(u, e.k) && (u.value = l), e.k && (p[e.k] = l));
      };
      if (l) {
        const z = () => {
          X(), fs.delete(e);
        };
        z.id = -1, fs.set(e, z), qe(z, n);
      } else
        Yo(e), X();
    }
  }
}
function Yo(e) {
  const t = fs.get(e);
  t && (t.flags |= 8, fs.delete(e));
}
xs().requestIdleCallback;
xs().cancelIdleCallback;
const Dn = (e) => !!e.type.__asyncLoader, ws = (e) => e.type.__isKeepAlive;
function Ka(e, t) {
  gr(e, "a", t);
}
function Wa(e, t) {
  gr(e, "da", t);
}
function gr(e, t, n = Ve) {
  const s = e.__wdc || (e.__wdc = () => {
    let o = n;
    for (; o; ) {
      if (o.isDeactivated)
        return;
      o = o.parent;
    }
    return e();
  });
  if (ks(t, s, n), n) {
    let o = n.parent;
    for (; o && o.parent; )
      ws(o.parent.vnode) && Qa(s, t, n, o), o = o.parent;
  }
}
function Qa(e, t, n, s) {
  const o = ks(
    t,
    e,
    s,
    !0
    /* prepend */
  );
  hr(() => {
    uo(s[t], o);
  }, n);
}
function ks(e, t, n = Ve, s = !1) {
  if (n) {
    const o = n[e] || (n[e] = []), i = t.__weh || (t.__weh = (...l) => {
      Rt();
      const c = zn(n), u = lt(t, n, e, l);
      return c(), Lt(), u;
    });
    return s ? o.unshift(i) : o.push(i), i;
  }
}
const Ot = (e) => (t, n = Ve) => {
  (!Un || e === "sp") && ks(e, (...s) => t(...s), n);
}, za = Ot("bm"), Co = Ot("m"), Ga = Ot(
  "bu"
), Ya = Ot("u"), wo = Ot(
  "bum"
), hr = Ot("um"), Xa = Ot(
  "sp"
), Ja = Ot("rtg"), Za = Ot("rtc");
function ec(e, t = Ve) {
  ks("ec", e, t);
}
const tc = /* @__PURE__ */ Symbol.for("v-ndc");
function Re(e, t, n, s) {
  let o;
  const i = n, l = Q(e);
  if (l || we(e)) {
    const c = l && /* @__PURE__ */ Zt(e);
    let u = !1, g = !1;
    c && (u = !/* @__PURE__ */ Je(e), g = /* @__PURE__ */ Nt(e), e = Ss(e)), o = new Array(e.length);
    for (let p = 0, m = e.length; p < m; p++)
      o[p] = t(
        u ? g ? mn(rt(e[p])) : rt(e[p]) : e[p],
        p,
        void 0,
        i
      );
  } else if (typeof e == "number") {
    o = new Array(e);
    for (let c = 0; c < e; c++)
      o[c] = t(c + 1, c, void 0, i);
  } else if (le(e))
    if (e[Symbol.iterator])
      o = Array.from(
        e,
        (c, u) => t(c, u, void 0, i)
      );
    else {
      const c = Object.keys(e);
      o = new Array(c.length);
      for (let u = 0, g = c.length; u < g; u++) {
        const p = c[u];
        o[u] = t(e[p], p, u, i);
      }
    }
  else
    o = [];
  return o;
}
const eo = (e) => e ? $r(e) ? Ms(e) : eo(e.parent) : null, $n = (
  // Move PURE marker to new line to workaround compiler discarding it
  // due to type annotation
  /* @__PURE__ */ Ee(/* @__PURE__ */ Object.create(null), {
    $: (e) => e,
    $el: (e) => e.vnode.el,
    $data: (e) => e.data,
    $props: (e) => e.props,
    $attrs: (e) => e.attrs,
    $slots: (e) => e.slots,
    $refs: (e) => e.refs,
    $parent: (e) => eo(e.parent),
    $root: (e) => eo(e.root),
    $host: (e) => e.ce,
    $emit: (e) => e.emit,
    $options: (e) => yr(e),
    $forceUpdate: (e) => e.f || (e.f = () => {
      So(e.update);
    }),
    $nextTick: (e) => e.n || (e.n = Gt.bind(e.proxy)),
    $watch: (e) => Ba.bind(e)
  })
), Bs = (e, t) => e !== ve && !e.__isScriptSetup && re(e, t), nc = {
  get({ _: e }, t) {
    if (t === "__v_skip")
      return !0;
    const { ctx: n, setupState: s, data: o, props: i, accessCache: l, type: c, appContext: u } = e;
    if (t[0] !== "$") {
      const k = l[t];
      if (k !== void 0)
        switch (k) {
          case 1:
            return s[t];
          case 2:
            return o[t];
          case 4:
            return n[t];
          case 3:
            return i[t];
        }
      else {
        if (Bs(s, t))
          return l[t] = 1, s[t];
        if (o !== ve && re(o, t))
          return l[t] = 2, o[t];
        if (re(i, t))
          return l[t] = 3, i[t];
        if (n !== ve && re(n, t))
          return l[t] = 4, n[t];
        to && (l[t] = 0);
      }
    }
    const g = $n[t];
    let p, m;
    if (g)
      return t === "$attrs" && De(e.attrs, "get", ""), g(e);
    if (
      // css module (injected by vue-loader)
      (p = c.__cssModules) && (p = p[t])
    )
      return p;
    if (n !== ve && re(n, t))
      return l[t] = 4, n[t];
    if (
      // global properties
      m = u.config.globalProperties, re(m, t)
    )
      return m[t];
  },
  set({ _: e }, t, n) {
    const { data: s, setupState: o, ctx: i } = e;
    return Bs(o, t) ? (o[t] = n, !0) : s !== ve && re(s, t) ? (s[t] = n, !0) : re(e.props, t) || t[0] === "$" && t.slice(1) in e ? !1 : (i[t] = n, !0);
  },
  has({
    _: { data: e, setupState: t, accessCache: n, ctx: s, appContext: o, props: i, type: l }
  }, c) {
    let u;
    return !!(n[c] || e !== ve && c[0] !== "$" && re(e, c) || Bs(t, c) || re(i, c) || re(s, c) || re($n, c) || re(o.config.globalProperties, c) || (u = l.__cssModules) && u[c]);
  },
  defineProperty(e, t, n) {
    return n.get != null ? e._.accessCache[t] = 0 : re(n, "value") && this.set(e, t, n.value, null), Reflect.defineProperty(e, t, n);
  }
};
function Xo(e) {
  return Q(e) ? e.reduce(
    (t, n) => (t[n] = null, t),
    {}
  ) : e;
}
let to = !0;
function sc(e) {
  const t = yr(e), n = e.proxy, s = e.ctx;
  to = !1, t.beforeCreate && Jo(t.beforeCreate, e, "bc");
  const {
    // state
    data: o,
    computed: i,
    methods: l,
    watch: c,
    provide: u,
    inject: g,
    // lifecycle
    created: p,
    beforeMount: m,
    mounted: k,
    beforeUpdate: T,
    updated: $,
    activated: M,
    deactivated: K,
    beforeDestroy: X,
    beforeUnmount: z,
    destroyed: F,
    unmounted: H,
    render: se,
    renderTracked: be,
    renderTriggered: ae,
    errorCaptured: Ne,
    serverPrefetch: G,
    // public API
    expose: ee,
    inheritAttrs: ye,
    // assets
    components: D,
    directives: ge,
    filters: Me
  } = t;
  if (g && oc(g, s, null), l)
    for (const ie in l) {
      const ue = l[ie];
      Y(ue) && (s[ie] = ue.bind(n));
    }
  if (o) {
    const ie = o.call(n, n);
    le(ie) && (e.data = /* @__PURE__ */ _o(ie));
  }
  if (to = !0, i)
    for (const ie in i) {
      const ue = i[ie], at = Y(ue) ? ue.bind(n, n) : Y(ue.get) ? ue.get.bind(n, n) : xt, tn = !Y(ue) && Y(ue.set) ? ue.set.bind(n) : xt, et = J({
        get: at,
        set: tn
      });
      Object.defineProperty(s, ie, {
        enumerable: !0,
        configurable: !0,
        get: () => et.value,
        set: (Qe) => et.value = Qe
      });
    }
  if (c)
    for (const ie in c)
      mr(c[ie], s, n, ie);
  if (u) {
    const ie = Y(u) ? u.call(n) : u;
    Reflect.ownKeys(ie).forEach((ue) => {
      $a(ue, ie[ue]);
    });
  }
  p && Jo(p, e, "c");
  function Ce(ie, ue) {
    Q(ue) ? ue.forEach((at) => ie(at.bind(n))) : ue && ie(ue.bind(n));
  }
  if (Ce(za, m), Ce(Co, k), Ce(Ga, T), Ce(Ya, $), Ce(Ka, M), Ce(Wa, K), Ce(ec, Ne), Ce(Za, be), Ce(Ja, ae), Ce(wo, z), Ce(hr, H), Ce(Xa, G), Q(ee))
    if (ee.length) {
      const ie = e.exposed || (e.exposed = {});
      ee.forEach((ue) => {
        Object.defineProperty(ie, ue, {
          get: () => n[ue],
          set: (at) => n[ue] = at,
          enumerable: !0
        });
      });
    } else e.exposed || (e.exposed = {});
  se && e.render === xt && (e.render = se), ye != null && (e.inheritAttrs = ye), D && (e.components = D), ge && (e.directives = ge), G && vr(e);
}
function oc(e, t, n = xt) {
  Q(e) && (e = no(e));
  for (const s in e) {
    const o = e[s];
    let i;
    le(o) ? "default" in o ? i = rs(
      o.from || s,
      o.default,
      !0
    ) : i = rs(o.from || s) : i = rs(o), /* @__PURE__ */ $e(i) ? Object.defineProperty(t, s, {
      enumerable: !0,
      configurable: !0,
      get: () => i.value,
      set: (l) => i.value = l
    }) : t[s] = i;
  }
}
function Jo(e, t, n) {
  lt(
    Q(e) ? e.map((s) => s.bind(t.proxy)) : e.bind(t.proxy),
    t,
    n
  );
}
function mr(e, t, n, s) {
  let o = s.includes(".") ? lr(n, s) : () => n[s];
  if (we(e)) {
    const i = t[e];
    Y(i) && Nn(o, i);
  } else if (Y(e))
    Nn(o, e.bind(n));
  else if (le(e))
    if (Q(e))
      e.forEach((i) => mr(i, t, n, s));
    else {
      const i = Y(e.handler) ? e.handler.bind(n) : t[e.handler];
      Y(i) && Nn(o, i, e);
    }
}
function yr(e) {
  const t = e.type, { mixins: n, extends: s } = t, {
    mixins: o,
    optionsCache: i,
    config: { optionMergeStrategies: l }
  } = e.appContext, c = i.get(t);
  let u;
  return c ? u = c : !o.length && !n && !s ? u = t : (u = {}, o.length && o.forEach(
    (g) => ds(u, g, l, !0)
  ), ds(u, t, l)), le(t) && i.set(t, u), u;
}
function ds(e, t, n, s = !1) {
  const { mixins: o, extends: i } = t;
  i && ds(e, i, n, !0), o && o.forEach(
    (l) => ds(e, l, n, !0)
  );
  for (const l in t)
    if (!(s && l === "expose")) {
      const c = ic[l] || n && n[l];
      e[l] = c ? c(e[l], t[l]) : t[l];
    }
  return e;
}
const ic = {
  data: Zo,
  props: ei,
  emits: ei,
  // objects
  methods: Tn,
  computed: Tn,
  // lifecycle
  beforeCreate: He,
  created: He,
  beforeMount: He,
  mounted: He,
  beforeUpdate: He,
  updated: He,
  beforeDestroy: He,
  beforeUnmount: He,
  destroyed: He,
  unmounted: He,
  activated: He,
  deactivated: He,
  errorCaptured: He,
  serverPrefetch: He,
  // assets
  components: Tn,
  directives: Tn,
  // watch
  watch: lc,
  // provide / inject
  provide: Zo,
  inject: rc
};
function Zo(e, t) {
  return t ? e ? function() {
    return Ee(
      Y(e) ? e.call(this, this) : e,
      Y(t) ? t.call(this, this) : t
    );
  } : t : e;
}
function rc(e, t) {
  return Tn(no(e), no(t));
}
function no(e) {
  if (Q(e)) {
    const t = {};
    for (let n = 0; n < e.length; n++)
      t[e[n]] = e[n];
    return t;
  }
  return e;
}
function He(e, t) {
  return e ? [...new Set([].concat(e, t))] : t;
}
function Tn(e, t) {
  return e ? Ee(/* @__PURE__ */ Object.create(null), e, t) : t;
}
function ei(e, t) {
  return e ? Q(e) && Q(t) ? [.../* @__PURE__ */ new Set([...e, ...t])] : Ee(
    /* @__PURE__ */ Object.create(null),
    Xo(e),
    Xo(t ?? {})
  ) : t;
}
function lc(e, t) {
  if (!e) return t;
  if (!t) return e;
  const n = Ee(/* @__PURE__ */ Object.create(null), e);
  for (const s in t)
    n[s] = He(e[s], t[s]);
  return n;
}
function _r() {
  return {
    app: null,
    config: {
      isNativeTag: Ei,
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
let ac = 0;
function cc(e, t) {
  return function(s, o = null) {
    Y(s) || (s = Ee({}, s)), o != null && !le(o) && (o = null);
    const i = _r(), l = /* @__PURE__ */ new WeakSet(), c = [];
    let u = !1;
    const g = i.app = {
      _uid: ac++,
      _component: s,
      _props: o,
      _container: null,
      _context: i,
      _instance: null,
      version: Vc,
      get config() {
        return i.config;
      },
      set config(p) {
      },
      use(p, ...m) {
        return l.has(p) || (p && Y(p.install) ? (l.add(p), p.install(g, ...m)) : Y(p) && (l.add(p), p(g, ...m))), g;
      },
      mixin(p) {
        return i.mixins.includes(p) || i.mixins.push(p), g;
      },
      component(p, m) {
        return m ? (i.components[p] = m, g) : i.components[p];
      },
      directive(p, m) {
        return m ? (i.directives[p] = m, g) : i.directives[p];
      },
      mount(p, m, k) {
        if (!u) {
          const T = g._ceVNode || ke(s, o);
          return T.appContext = i, k === !0 ? k = "svg" : k === !1 && (k = void 0), e(T, p, k), u = !0, g._container = p, p.__vue_app__ = g, Ms(T.component);
        }
      },
      onUnmount(p) {
        c.push(p);
      },
      unmount() {
        u && (lt(
          c,
          g._instance,
          16
        ), e(null, g._container), delete g._container.__vue_app__);
      },
      provide(p, m) {
        return i.provides[p] = m, g;
      },
      runWithContext(p) {
        const m = gn;
        gn = g;
        try {
          return p();
        } finally {
          gn = m;
        }
      }
    };
    return g;
  };
}
let gn = null;
const uc = (e, t) => t === "modelValue" || t === "model-value" ? e.modelModifiers : e[`${t}Modifiers`] || e[`${ot(t)}Modifiers`] || e[`${en(t)}Modifiers`];
function fc(e, t, ...n) {
  if (e.isUnmounted) return;
  const s = e.vnode.props || ve;
  let o = n;
  const i = t.startsWith("update:"), l = i && uc(s, t.slice(7));
  l && (l.trim && (o = n.map((p) => we(p) ? p.trim() : p)), l.number && (o = n.map(Gl)));
  let c, u = s[c = Ls(t)] || // also try camelCase event handler (#2249)
  s[c = Ls(ot(t))];
  !u && i && (u = s[c = Ls(en(t))]), u && lt(
    u,
    e,
    6,
    o
  );
  const g = s[c + "Once"];
  if (g) {
    if (!e.emitted)
      e.emitted = {};
    else if (e.emitted[c])
      return;
    e.emitted[c] = !0, lt(
      g,
      e,
      6,
      o
    );
  }
}
const dc = /* @__PURE__ */ new WeakMap();
function br(e, t, n = !1) {
  const s = n ? dc : t.emitsCache, o = s.get(e);
  if (o !== void 0)
    return o;
  const i = e.emits;
  let l = {}, c = !1;
  if (!Y(e)) {
    const u = (g) => {
      const p = br(g, t, !0);
      p && (c = !0, Ee(l, p));
    };
    !n && t.mixins.length && t.mixins.forEach(u), e.extends && u(e.extends), e.mixins && e.mixins.forEach(u);
  }
  return !i && !c ? (le(e) && s.set(e, null), null) : (Q(i) ? i.forEach((u) => l[u] = null) : Ee(l, i), le(e) && s.set(e, l), l);
}
function As(e, t) {
  return !e || !ys(t) ? !1 : (t = t.slice(2).replace(/Once$/, ""), re(e, t[0].toLowerCase() + t.slice(1)) || re(e, en(t)) || re(e, t));
}
function ti(e) {
  const {
    type: t,
    vnode: n,
    proxy: s,
    withProxy: o,
    propsOptions: [i],
    slots: l,
    attrs: c,
    emit: u,
    render: g,
    renderCache: p,
    props: m,
    data: k,
    setupState: T,
    ctx: $,
    inheritAttrs: M
  } = e, K = us(e);
  let X, z;
  try {
    if (n.shapeFlag & 4) {
      const H = o || s, se = H;
      X = mt(
        g.call(
          se,
          H,
          p,
          m,
          T,
          k,
          $
        )
      ), z = c;
    } else {
      const H = t;
      X = mt(
        H.length > 1 ? H(
          m,
          { attrs: c, slots: l, emit: u }
        ) : H(
          m,
          null
        )
      ), z = t.props ? c : pc(c);
    }
  } catch (H) {
    Fn.length = 0, Cs(H, e, 1), X = ke(je);
  }
  let F = X;
  if (z && M !== !1) {
    const H = Object.keys(z), { shapeFlag: se } = F;
    H.length && se & 7 && (i && H.some(_s) && (z = vc(
      z,
      i
    )), F = qt(F, z, !1, !0));
  }
  return n.dirs && (F = qt(F, null, !1, !0), F.dirs = F.dirs ? F.dirs.concat(n.dirs) : n.dirs), n.transition && Vn(F, n.transition), X = F, us(K), X;
}
const pc = (e) => {
  let t;
  for (const n in e)
    (n === "class" || n === "style" || ys(n)) && ((t || (t = {}))[n] = e[n]);
  return t;
}, vc = (e, t) => {
  const n = {};
  for (const s in e)
    (!_s(s) || !(s.slice(9) in t)) && (n[s] = e[s]);
  return n;
};
function gc(e, t, n) {
  const { props: s, children: o, component: i } = e, { props: l, children: c, patchFlag: u } = t, g = i.emitsOptions;
  if (t.dirs || t.transition)
    return !0;
  if (n && u >= 0) {
    if (u & 1024)
      return !0;
    if (u & 16)
      return s ? ni(s, l, g) : !!l;
    if (u & 8) {
      const p = t.dynamicProps;
      for (let m = 0; m < p.length; m++) {
        const k = p[m];
        if (xr(l, s, k) && !As(g, k))
          return !0;
      }
    }
  } else
    return (o || c) && (!c || !c.$stable) ? !0 : s === l ? !1 : s ? l ? ni(s, l, g) : !0 : !!l;
  return !1;
}
function ni(e, t, n) {
  const s = Object.keys(t);
  if (s.length !== Object.keys(e).length)
    return !0;
  for (let o = 0; o < s.length; o++) {
    const i = s[o];
    if (xr(t, e, i) && !As(n, i))
      return !0;
  }
  return !1;
}
function xr(e, t, n) {
  const s = e[n], o = t[n];
  return n === "style" && le(s) && le(o) ? !po(s, o) : s !== o;
}
function hc({ vnode: e, parent: t, suspense: n }, s) {
  for (; t; ) {
    const o = t.subTree;
    if (o.suspense && o.suspense.activeBranch === e && (o.suspense.vnode.el = o.el = s, e = o), o === e)
      (e = t.vnode).el = s, t = t.parent;
    else
      break;
  }
  n && n.activeBranch === e && (n.vnode.el = s);
}
const Sr = {}, Cr = () => Object.create(Sr), wr = (e) => Object.getPrototypeOf(e) === Sr;
function mc(e, t, n, s = !1) {
  const o = {}, i = Cr();
  e.propsDefaults = /* @__PURE__ */ Object.create(null), kr(e, t, o, i);
  for (const l in e.propsOptions[0])
    l in o || (o[l] = void 0);
  n ? e.props = s ? o : /* @__PURE__ */ wa(o) : e.type.props ? e.props = o : e.props = i, e.attrs = i;
}
function yc(e, t, n, s) {
  const {
    props: o,
    attrs: i,
    vnode: { patchFlag: l }
  } = e, c = /* @__PURE__ */ oe(o), [u] = e.propsOptions;
  let g = !1;
  if (
    // always force full diff in dev
    // - #1942 if hmr is enabled with sfc component
    // - vite#872 non-sfc component used by sfc component
    (s || l > 0) && !(l & 16)
  ) {
    if (l & 8) {
      const p = e.vnode.dynamicProps;
      for (let m = 0; m < p.length; m++) {
        let k = p[m];
        if (As(e.emitsOptions, k))
          continue;
        const T = t[k];
        if (u)
          if (re(i, k))
            T !== i[k] && (i[k] = T, g = !0);
          else {
            const $ = ot(k);
            o[$] = so(
              u,
              c,
              $,
              T,
              e,
              !1
            );
          }
        else
          T !== i[k] && (i[k] = T, g = !0);
      }
    }
  } else {
    kr(e, t, o, i) && (g = !0);
    let p;
    for (const m in c)
      (!t || // for camelCase
      !re(t, m) && // it's possible the original props was passed in as kebab-case
      // and converted to camelCase (#955)
      ((p = en(m)) === m || !re(t, p))) && (u ? n && // for camelCase
      (n[m] !== void 0 || // for kebab-case
      n[p] !== void 0) && (o[m] = so(
        u,
        c,
        m,
        void 0,
        e,
        !0
      )) : delete o[m]);
    if (i !== c)
      for (const m in i)
        (!t || !re(t, m)) && (delete i[m], g = !0);
  }
  g && Tt(e.attrs, "set", "");
}
function kr(e, t, n, s) {
  const [o, i] = e.propsOptions;
  let l = !1, c;
  if (t)
    for (let u in t) {
      if (In(u))
        continue;
      const g = t[u];
      let p;
      o && re(o, p = ot(u)) ? !i || !i.includes(p) ? n[p] = g : (c || (c = {}))[p] = g : As(e.emitsOptions, u) || (!(u in s) || g !== s[u]) && (s[u] = g, l = !0);
    }
  if (i) {
    const u = /* @__PURE__ */ oe(n), g = c || ve;
    for (let p = 0; p < i.length; p++) {
      const m = i[p];
      n[m] = so(
        o,
        u,
        m,
        g[m],
        e,
        !re(g, m)
      );
    }
  }
  return l;
}
function so(e, t, n, s, o, i) {
  const l = e[n];
  if (l != null) {
    const c = re(l, "default");
    if (c && s === void 0) {
      const u = l.default;
      if (l.type !== Function && !l.skipFactory && Y(u)) {
        const { propsDefaults: g } = o;
        if (n in g)
          s = g[n];
        else {
          const p = zn(o);
          s = g[n] = u.call(
            null,
            t
          ), p();
        }
      } else
        s = u;
      o.ce && o.ce._setProp(n, s);
    }
    l[
      0
      /* shouldCast */
    ] && (i && !c ? s = !1 : l[
      1
      /* shouldCastTrue */
    ] && (s === "" || s === en(n)) && (s = !0));
  }
  return s;
}
const _c = /* @__PURE__ */ new WeakMap();
function Ar(e, t, n = !1) {
  const s = n ? _c : t.propsCache, o = s.get(e);
  if (o)
    return o;
  const i = e.props, l = {}, c = [];
  let u = !1;
  if (!Y(e)) {
    const p = (m) => {
      u = !0;
      const [k, T] = Ar(m, t, !0);
      Ee(l, k), T && c.push(...T);
    };
    !n && t.mixins.length && t.mixins.forEach(p), e.extends && p(e.extends), e.mixins && e.mixins.forEach(p);
  }
  if (!i && !u)
    return le(e) && s.set(e, dn), dn;
  if (Q(i))
    for (let p = 0; p < i.length; p++) {
      const m = ot(i[p]);
      si(m) && (l[m] = ve);
    }
  else if (i)
    for (const p in i) {
      const m = ot(p);
      if (si(m)) {
        const k = i[p], T = l[m] = Q(k) || Y(k) ? { type: k } : Ee({}, k), $ = T.type;
        let M = !1, K = !0;
        if (Q($))
          for (let X = 0; X < $.length; ++X) {
            const z = $[X], F = Y(z) && z.name;
            if (F === "Boolean") {
              M = !0;
              break;
            } else F === "String" && (K = !1);
          }
        else
          M = Y($) && $.name === "Boolean";
        T[
          0
          /* shouldCast */
        ] = M, T[
          1
          /* shouldCastTrue */
        ] = K, (M || re(T, "default")) && c.push(m);
      }
    }
  const g = [l, c];
  return le(e) && s.set(e, g), g;
}
function si(e) {
  return e[0] !== "$" && !In(e);
}
const ko = (e) => e === "_" || e === "_ctx" || e === "$stable", Ao = (e) => Q(e) ? e.map(mt) : [mt(e)], bc = (e, t, n) => {
  if (t._n)
    return t;
  const s = pt((...o) => Ao(t(...o)), n);
  return s._c = !1, s;
}, Pr = (e, t, n) => {
  const s = e._ctx;
  for (const o in e) {
    if (ko(o)) continue;
    const i = e[o];
    if (Y(i))
      t[o] = bc(o, i, s);
    else if (i != null) {
      const l = Ao(i);
      t[o] = () => l;
    }
  }
}, Mr = (e, t) => {
  const n = Ao(t);
  e.slots.default = () => n;
}, Tr = (e, t, n) => {
  for (const s in t)
    (n || !ko(s)) && (e[s] = t[s]);
}, xc = (e, t, n) => {
  const s = e.slots = Cr();
  if (e.vnode.shapeFlag & 32) {
    const o = t._;
    o ? (Tr(s, t, n), n && Di(s, "_", o, !0)) : Pr(t, s);
  } else t && Mr(e, t);
}, Sc = (e, t, n) => {
  const { vnode: s, slots: o } = e;
  let i = !0, l = ve;
  if (s.shapeFlag & 32) {
    const c = t._;
    c ? n && c === 1 ? i = !1 : Tr(o, t, n) : (i = !t.$stable, Pr(t, o)), l = t;
  } else t && (Mr(e, t), l = { default: 1 });
  if (i)
    for (const c in o)
      !ko(c) && l[c] == null && delete o[c];
}, qe = Pc;
function Cc(e) {
  return wc(e);
}
function wc(e, t) {
  const n = xs();
  n.__VUE__ = !0;
  const {
    insert: s,
    remove: o,
    patchProp: i,
    createElement: l,
    createText: c,
    createComment: u,
    setText: g,
    setElementText: p,
    parentNode: m,
    nextSibling: k,
    setScopeId: T = xt,
    insertStaticContent: $
  } = e, M = (v, h, b, P = null, C = null, w = null, L = void 0, I = null, E = !!h.dynamicChildren) => {
    if (v === h)
      return;
    v && !Yt(v, h) && (P = $t(v), Qe(v, C, w, !0), v = null), h.patchFlag === -2 && (E = !1, h.dynamicChildren = null);
    const { type: A, ref: U, shapeFlag: N } = h;
    switch (A) {
      case Ps:
        K(v, h, b, P);
        break;
      case je:
        X(v, h, b, P);
        break;
      case Vs:
        v == null && z(h, b, P, L);
        break;
      case de:
        D(
          v,
          h,
          b,
          P,
          C,
          w,
          L,
          I,
          E
        );
        break;
      default:
        N & 1 ? se(
          v,
          h,
          b,
          P,
          C,
          w,
          L,
          I,
          E
        ) : N & 6 ? ge(
          v,
          h,
          b,
          P,
          C,
          w,
          L,
          I,
          E
        ) : (N & 64 || N & 128) && A.process(
          v,
          h,
          b,
          P,
          C,
          w,
          L,
          I,
          E,
          Ft
        );
    }
    U != null && C ? On(U, v && v.ref, w, h || v, !h) : U == null && v && v.ref != null && On(v.ref, null, w, v, !0);
  }, K = (v, h, b, P) => {
    if (v == null)
      s(
        h.el = c(h.children),
        b,
        P
      );
    else {
      const C = h.el = v.el;
      h.children !== v.children && g(C, h.children);
    }
  }, X = (v, h, b, P) => {
    v == null ? s(
      h.el = u(h.children || ""),
      b,
      P
    ) : h.el = v.el;
  }, z = (v, h, b, P) => {
    [v.el, v.anchor] = $(
      v.children,
      h,
      b,
      P,
      v.el,
      v.anchor
    );
  }, F = ({ el: v, anchor: h }, b, P) => {
    let C;
    for (; v && v !== h; )
      C = k(v), s(v, b, P), v = C;
    s(h, b, P);
  }, H = ({ el: v, anchor: h }) => {
    let b;
    for (; v && v !== h; )
      b = k(v), o(v), v = b;
    o(h);
  }, se = (v, h, b, P, C, w, L, I, E) => {
    if (h.type === "svg" ? L = "svg" : h.type === "math" && (L = "mathml"), v == null)
      be(
        h,
        b,
        P,
        C,
        w,
        L,
        I,
        E
      );
    else {
      const A = v.el && v.el._isVueCE ? v.el : null;
      try {
        A && A._beginPatch(), G(
          v,
          h,
          C,
          w,
          L,
          I,
          E
        );
      } finally {
        A && A._endPatch();
      }
    }
  }, be = (v, h, b, P, C, w, L, I) => {
    let E, A;
    const { props: U, shapeFlag: N, transition: V, dirs: W } = v;
    if (E = v.el = l(
      v.type,
      w,
      U && U.is,
      U
    ), N & 8 ? p(E, v.children) : N & 16 && Ne(
      v.children,
      E,
      null,
      P,
      C,
      js(v, w),
      L,
      I
    ), W && Ut(v, null, P, "created"), ae(E, v, v.scopeId, L, P), U) {
      for (const ce in U)
        ce !== "value" && !In(ce) && i(E, ce, null, U[ce], w, P);
      "value" in U && i(E, "value", null, U.value, w), (A = U.onVnodeBeforeMount) && dt(A, P, v);
    }
    W && Ut(v, null, P, "beforeMount");
    const ne = kc(C, V);
    ne && V.beforeEnter(E), s(E, h, b), ((A = U && U.onVnodeMounted) || ne || W) && qe(() => {
      A && dt(A, P, v), ne && V.enter(E), W && Ut(v, null, P, "mounted");
    }, C);
  }, ae = (v, h, b, P, C) => {
    if (b && T(v, b), P)
      for (let w = 0; w < P.length; w++)
        T(v, P[w]);
    if (C) {
      let w = C.subTree;
      if (h === w || Lr(w.type) && (w.ssContent === h || w.ssFallback === h)) {
        const L = C.vnode;
        ae(
          v,
          L,
          L.scopeId,
          L.slotScopeIds,
          C.parent
        );
      }
    }
  }, Ne = (v, h, b, P, C, w, L, I, E = 0) => {
    for (let A = E; A < v.length; A++) {
      const U = v[A] = I ? Mt(v[A]) : mt(v[A]);
      M(
        null,
        U,
        h,
        b,
        P,
        C,
        w,
        L,
        I
      );
    }
  }, G = (v, h, b, P, C, w, L) => {
    const I = h.el = v.el;
    let { patchFlag: E, dynamicChildren: A, dirs: U } = h;
    E |= v.patchFlag & 16;
    const N = v.props || ve, V = h.props || ve;
    let W;
    if (b && Kt(b, !1), (W = V.onVnodeBeforeUpdate) && dt(W, b, h, v), U && Ut(h, v, b, "beforeUpdate"), b && Kt(b, !0), (N.innerHTML && V.innerHTML == null || N.textContent && V.textContent == null) && p(I, ""), A ? ee(
      v.dynamicChildren,
      A,
      I,
      b,
      P,
      js(h, C),
      w
    ) : L || ue(
      v,
      h,
      I,
      null,
      b,
      P,
      js(h, C),
      w,
      !1
    ), E > 0) {
      if (E & 16)
        ye(I, N, V, b, C);
      else if (E & 2 && N.class !== V.class && i(I, "class", null, V.class, C), E & 4 && i(I, "style", N.style, V.style, C), E & 8) {
        const ne = h.dynamicProps;
        for (let ce = 0; ce < ne.length; ce++) {
          const fe = ne[ce], xe = N[fe], Pe = V[fe];
          (Pe !== xe || fe === "value") && i(I, fe, xe, Pe, C, b);
        }
      }
      E & 1 && v.children !== h.children && p(I, h.children);
    } else !L && A == null && ye(I, N, V, b, C);
    ((W = V.onVnodeUpdated) || U) && qe(() => {
      W && dt(W, b, h, v), U && Ut(h, v, b, "updated");
    }, P);
  }, ee = (v, h, b, P, C, w, L) => {
    for (let I = 0; I < h.length; I++) {
      const E = v[I], A = h[I], U = (
        // oldVNode may be an errored async setup() component inside Suspense
        // which will not have a mounted element
        E.el && // - In the case of a Fragment, we need to provide the actual parent
        // of the Fragment itself so it can move its children.
        (E.type === de || // - In the case of different nodes, there is going to be a replacement
        // which also requires the correct parent container
        !Yt(E, A) || // - In the case of a component, it could contain anything.
        E.shapeFlag & 198) ? m(E.el) : (
          // In other cases, the parent container is not actually used so we
          // just pass the block element here to avoid a DOM parentNode call.
          b
        )
      );
      M(
        E,
        A,
        U,
        null,
        P,
        C,
        w,
        L,
        !0
      );
    }
  }, ye = (v, h, b, P, C) => {
    if (h !== b) {
      if (h !== ve)
        for (const w in h)
          !In(w) && !(w in b) && i(
            v,
            w,
            h[w],
            null,
            C,
            P
          );
      for (const w in b) {
        if (In(w)) continue;
        const L = b[w], I = h[w];
        L !== I && w !== "value" && i(v, w, I, L, C, P);
      }
      "value" in b && i(v, "value", h.value, b.value, C);
    }
  }, D = (v, h, b, P, C, w, L, I, E) => {
    const A = h.el = v ? v.el : c(""), U = h.anchor = v ? v.anchor : c("");
    let { patchFlag: N, dynamicChildren: V, slotScopeIds: W } = h;
    W && (I = I ? I.concat(W) : W), v == null ? (s(A, b, P), s(U, b, P), Ne(
      // #10007
      // such fragment like `<></>` will be compiled into
      // a fragment which doesn't have a children.
      // In this case fallback to an empty array
      h.children || [],
      b,
      U,
      C,
      w,
      L,
      I,
      E
    )) : N > 0 && N & 64 && V && // #2715 the previous fragment could've been a BAILed one as a result
    // of renderSlot() with no valid children
    v.dynamicChildren && v.dynamicChildren.length === V.length ? (ee(
      v.dynamicChildren,
      V,
      b,
      C,
      w,
      L,
      I
    ), // #2080 if the stable fragment has a key, it's a <template v-for> that may
    //  get moved around. Make sure all root level vnodes inherit el.
    // #2134 or if it's a component root, it may also get moved around
    // as the component is being moved.
    (h.key != null || C && h === C.subTree) && Er(
      v,
      h,
      !0
      /* shallow */
    )) : ue(
      v,
      h,
      b,
      U,
      C,
      w,
      L,
      I,
      E
    );
  }, ge = (v, h, b, P, C, w, L, I, E) => {
    h.slotScopeIds = I, v == null ? h.shapeFlag & 512 ? C.ctx.activate(
      h,
      b,
      P,
      L,
      E
    ) : Me(
      h,
      b,
      P,
      C,
      w,
      L,
      E
    ) : Ze(v, h, E);
  }, Me = (v, h, b, P, C, w, L) => {
    const I = v.component = Oc(
      v,
      P,
      C
    );
    if (ws(v) && (I.ctx.renderer = Ft), Dc(I, !1, L), I.asyncDep) {
      if (C && C.registerDep(I, Ce, L), !v.el) {
        const E = I.subTree = ke(je);
        X(null, E, h, b), v.placeholder = E.el;
      }
    } else
      Ce(
        I,
        v,
        h,
        b,
        C,
        w,
        L
      );
  }, Ze = (v, h, b) => {
    const P = h.component = v.component;
    if (gc(v, h, b))
      if (P.asyncDep && !P.asyncResolved) {
        ie(P, h, b);
        return;
      } else
        P.next = h, P.update();
    else
      h.el = v.el, P.vnode = h;
  }, Ce = (v, h, b, P, C, w, L) => {
    const I = () => {
      if (v.isMounted) {
        let { next: N, bu: V, u: W, parent: ne, vnode: ce } = v;
        {
          const Ge = Ir(v);
          if (Ge) {
            N && (N.el = ce.el, ie(v, N, L)), Ge.asyncDep.then(() => {
              qe(() => {
                v.isUnmounted || A();
              }, C);
            });
            return;
          }
        }
        let fe = N, xe;
        Kt(v, !1), N ? (N.el = ce.el, ie(v, N, L)) : N = ce, V && Ns(V), (xe = N.props && N.props.onVnodeBeforeUpdate) && dt(xe, ne, N, ce), Kt(v, !0);
        const Pe = ti(v), ze = v.subTree;
        v.subTree = Pe, M(
          ze,
          Pe,
          // parent may have changed if it's in a teleport
          m(ze.el),
          // anchor may have changed if it's in a fragment
          $t(ze),
          v,
          C,
          w
        ), N.el = Pe.el, fe === null && hc(v, Pe.el), W && qe(W, C), (xe = N.props && N.props.onVnodeUpdated) && qe(
          () => dt(xe, ne, N, ce),
          C
        );
      } else {
        let N;
        const { el: V, props: W } = h, { bm: ne, m: ce, parent: fe, root: xe, type: Pe } = v, ze = Dn(h);
        Kt(v, !1), ne && Ns(ne), !ze && (N = W && W.onVnodeBeforeMount) && dt(N, fe, h), Kt(v, !0);
        {
          xe.ce && xe.ce._hasShadowRoot() && xe.ce._injectChildStyle(
            Pe,
            v.parent ? v.parent.type : void 0
          );
          const Ge = v.subTree = ti(v);
          M(
            null,
            Ge,
            b,
            P,
            v,
            C,
            w
          ), h.el = Ge.el;
        }
        if (ce && qe(ce, C), !ze && (N = W && W.onVnodeMounted)) {
          const Ge = h;
          qe(
            () => dt(N, fe, Ge),
            C
          );
        }
        (h.shapeFlag & 256 || fe && Dn(fe.vnode) && fe.vnode.shapeFlag & 256) && v.a && qe(v.a, C), v.isMounted = !0, h = b = P = null;
      }
    };
    v.scope.on();
    const E = v.effect = new Bi(I);
    v.scope.off();
    const A = v.update = E.run.bind(E), U = v.job = E.runIfDirty.bind(E);
    U.i = v, U.id = v.uid, E.scheduler = () => So(U), Kt(v, !0), A();
  }, ie = (v, h, b) => {
    h.component = v;
    const P = v.vnode.props;
    v.vnode = h, v.next = null, yc(v, h.props, P, b), Sc(v, h.children, b), Rt(), Qo(v), Lt();
  }, ue = (v, h, b, P, C, w, L, I, E = !1) => {
    const A = v && v.children, U = v ? v.shapeFlag : 0, N = h.children, { patchFlag: V, shapeFlag: W } = h;
    if (V > 0) {
      if (V & 128) {
        tn(
          A,
          N,
          b,
          P,
          C,
          w,
          L,
          I,
          E
        );
        return;
      } else if (V & 256) {
        at(
          A,
          N,
          b,
          P,
          C,
          w,
          L,
          I,
          E
        );
        return;
      }
    }
    W & 8 ? (U & 16 && ct(A, C, w), N !== A && p(b, N)) : U & 16 ? W & 16 ? tn(
      A,
      N,
      b,
      P,
      C,
      w,
      L,
      I,
      E
    ) : ct(A, C, w, !0) : (U & 8 && p(b, ""), W & 16 && Ne(
      N,
      b,
      P,
      C,
      w,
      L,
      I,
      E
    ));
  }, at = (v, h, b, P, C, w, L, I, E) => {
    v = v || dn, h = h || dn;
    const A = v.length, U = h.length, N = Math.min(A, U);
    let V;
    for (V = 0; V < N; V++) {
      const W = h[V] = E ? Mt(h[V]) : mt(h[V]);
      M(
        v[V],
        W,
        b,
        null,
        C,
        w,
        L,
        I,
        E
      );
    }
    A > U ? ct(
      v,
      C,
      w,
      !0,
      !1,
      N
    ) : Ne(
      h,
      b,
      P,
      C,
      w,
      L,
      I,
      E,
      N
    );
  }, tn = (v, h, b, P, C, w, L, I, E) => {
    let A = 0;
    const U = h.length;
    let N = v.length - 1, V = U - 1;
    for (; A <= N && A <= V; ) {
      const W = v[A], ne = h[A] = E ? Mt(h[A]) : mt(h[A]);
      if (Yt(W, ne))
        M(
          W,
          ne,
          b,
          null,
          C,
          w,
          L,
          I,
          E
        );
      else
        break;
      A++;
    }
    for (; A <= N && A <= V; ) {
      const W = v[N], ne = h[V] = E ? Mt(h[V]) : mt(h[V]);
      if (Yt(W, ne))
        M(
          W,
          ne,
          b,
          null,
          C,
          w,
          L,
          I,
          E
        );
      else
        break;
      N--, V--;
    }
    if (A > N) {
      if (A <= V) {
        const W = V + 1, ne = W < U ? h[W].el : P;
        for (; A <= V; )
          M(
            null,
            h[A] = E ? Mt(h[A]) : mt(h[A]),
            b,
            ne,
            C,
            w,
            L,
            I,
            E
          ), A++;
      }
    } else if (A > V)
      for (; A <= N; )
        Qe(v[A], C, w, !0), A++;
    else {
      const W = A, ne = A, ce = /* @__PURE__ */ new Map();
      for (A = ne; A <= V; A++) {
        const Oe = h[A] = E ? Mt(h[A]) : mt(h[A]);
        Oe.key != null && ce.set(Oe.key, A);
      }
      let fe, xe = 0;
      const Pe = V - ne + 1;
      let ze = !1, Ge = 0;
      const Ht = new Array(Pe);
      for (A = 0; A < Pe; A++) Ht[A] = 0;
      for (A = W; A <= N; A++) {
        const Oe = v[A];
        if (xe >= Pe) {
          Qe(Oe, C, w, !0);
          continue;
        }
        let Ie;
        if (Oe.key != null)
          Ie = ce.get(Oe.key);
        else
          for (fe = ne; fe <= V; fe++)
            if (Ht[fe - ne] === 0 && Yt(Oe, h[fe])) {
              Ie = fe;
              break;
            }
        Ie === void 0 ? Qe(Oe, C, w, !0) : (Ht[Ie - ne] = A + 1, Ie >= Ge ? Ge = Ie : ze = !0, M(
          Oe,
          h[Ie],
          b,
          null,
          C,
          w,
          L,
          I,
          E
        ), xe++);
      }
      const Yn = ze ? Ac(Ht) : dn;
      for (fe = Yn.length - 1, A = Pe - 1; A >= 0; A--) {
        const Oe = ne + A, Ie = h[Oe], _n = h[Oe + 1], Xn = Oe + 1 < U ? (
          // #13559, #14173 fallback to el placeholder for unresolved async component
          _n.el || Rr(_n)
        ) : P;
        Ht[A] === 0 ? M(
          null,
          Ie,
          b,
          Xn,
          C,
          w,
          L,
          I,
          E
        ) : ze && (fe < 0 || A !== Yn[fe] ? et(Ie, b, Xn, 2) : fe--);
      }
    }
  }, et = (v, h, b, P, C = null) => {
    const { el: w, type: L, transition: I, children: E, shapeFlag: A } = v;
    if (A & 6) {
      et(v.component.subTree, h, b, P);
      return;
    }
    if (A & 128) {
      v.suspense.move(h, b, P);
      return;
    }
    if (A & 64) {
      L.move(v, h, b, Ft);
      return;
    }
    if (L === de) {
      s(w, h, b);
      for (let N = 0; N < E.length; N++)
        et(E[N], h, b, P);
      s(v.anchor, h, b);
      return;
    }
    if (L === Vs) {
      F(v, h, b);
      return;
    }
    if (P !== 2 && A & 1 && I)
      if (P === 0)
        I.beforeEnter(w), s(w, h, b), qe(() => I.enter(w), C);
      else {
        const { leave: N, delayLeave: V, afterLeave: W } = I, ne = () => {
          v.ctx.isUnmounted ? o(w) : s(w, h, b);
        }, ce = () => {
          w._isLeaving && w[gt](
            !0
            /* cancelled */
          ), N(w, () => {
            ne(), W && W();
          });
        };
        V ? V(w, ne, ce) : ce();
      }
    else
      s(w, h, b);
  }, Qe = (v, h, b, P = !1, C = !1) => {
    const {
      type: w,
      props: L,
      ref: I,
      children: E,
      dynamicChildren: A,
      shapeFlag: U,
      patchFlag: N,
      dirs: V,
      cacheIndex: W,
      memo: ne
    } = v;
    if (N === -2 && (C = !1), I != null && (Rt(), On(I, null, b, v, !0), Lt()), W != null && (h.renderCache[W] = void 0), U & 256) {
      h.ctx.deactivate(v);
      return;
    }
    const ce = U & 1 && V, fe = !Dn(v);
    let xe;
    if (fe && (xe = L && L.onVnodeBeforeUnmount) && dt(xe, h, v), U & 6)
      yn(v.component, b, P);
    else {
      if (U & 128) {
        v.suspense.unmount(b, P);
        return;
      }
      ce && Ut(v, null, h, "beforeUnmount"), U & 64 ? v.type.remove(
        v,
        h,
        b,
        Ft,
        P
      ) : A && // #5154
      // when v-once is used inside a block, setBlockTracking(-1) marks the
      // parent block with hasOnce: true
      // so that it doesn't take the fast path during unmount - otherwise
      // components nested in v-once are never unmounted.
      !A.hasOnce && // #1153: fast path should not be taken for non-stable (v-for) fragments
      (w !== de || N > 0 && N & 64) ? ct(
        A,
        h,
        b,
        !1,
        !0
      ) : (w === de && N & 384 || !C && U & 16) && ct(E, h, b), P && Dt(v);
    }
    const Pe = ne != null && W == null;
    (fe && (xe = L && L.onVnodeUnmounted) || ce || Pe) && qe(() => {
      xe && dt(xe, h, v), ce && Ut(v, null, h, "unmounted"), Pe && (v.el = null);
    }, b);
  }, Dt = (v) => {
    const { type: h, el: b, anchor: P, transition: C } = v;
    if (h === de) {
      Gn(b, P);
      return;
    }
    if (h === Vs) {
      H(v);
      return;
    }
    const w = () => {
      o(b), C && !C.persisted && C.afterLeave && C.afterLeave();
    };
    if (v.shapeFlag & 1 && C && !C.persisted) {
      const { leave: L, delayLeave: I } = C, E = () => L(b, w);
      I ? I(v.el, w, E) : E();
    } else
      w();
  }, Gn = (v, h) => {
    let b;
    for (; v !== h; )
      b = k(v), o(v), v = b;
    o(h);
  }, yn = (v, h, b) => {
    const { bum: P, scope: C, job: w, subTree: L, um: I, m: E, a: A } = v;
    oi(E), oi(A), P && Ns(P), C.stop(), w && (w.flags |= 8, Qe(L, v, h, b)), I && qe(I, h), qe(() => {
      v.isUnmounted = !0;
    }, h);
  }, ct = (v, h, b, P = !1, C = !1, w = 0) => {
    for (let L = w; L < v.length; L++)
      Qe(v[L], h, b, P, C);
  }, $t = (v) => {
    if (v.shapeFlag & 6)
      return $t(v.component.subTree);
    if (v.shapeFlag & 128)
      return v.suspense.next();
    const h = k(v.anchor || v.el), b = h && h[ja];
    return b ? k(b) : h;
  };
  let nn = !1;
  const te = (v, h, b) => {
    let P;
    v == null ? h._vnode && (Qe(h._vnode, null, null, !0), P = h._vnode.component) : M(
      h._vnode || null,
      v,
      h,
      null,
      null,
      null,
      b
    ), h._vnode = v, nn || (nn = !0, Qo(P), sr(), nn = !1);
  }, Ft = {
    p: M,
    um: Qe,
    m: et,
    r: Dt,
    mt: Me,
    mc: Ne,
    pc: ue,
    pbc: ee,
    n: $t,
    o: e
  };
  return {
    render: te,
    hydrate: void 0,
    createApp: cc(te)
  };
}
function js({ type: e, props: t }, n) {
  return n === "svg" && e === "foreignObject" || n === "mathml" && e === "annotation-xml" && t && t.encoding && t.encoding.includes("html") ? void 0 : n;
}
function Kt({ effect: e, job: t }, n) {
  n ? (e.flags |= 32, t.flags |= 4) : (e.flags &= -33, t.flags &= -5);
}
function kc(e, t) {
  return (!e || e && !e.pendingBranch) && t && !t.persisted;
}
function Er(e, t, n = !1) {
  const s = e.children, o = t.children;
  if (Q(s) && Q(o))
    for (let i = 0; i < s.length; i++) {
      const l = s[i];
      let c = o[i];
      c.shapeFlag & 1 && !c.dynamicChildren && ((c.patchFlag <= 0 || c.patchFlag === 32) && (c = o[i] = Mt(o[i]), c.el = l.el), !n && c.patchFlag !== -2 && Er(l, c)), c.type === Ps && (c.patchFlag === -1 && (c = o[i] = Mt(c)), c.el = l.el), c.type === je && !c.el && (c.el = l.el);
    }
}
function Ac(e) {
  const t = e.slice(), n = [0];
  let s, o, i, l, c;
  const u = e.length;
  for (s = 0; s < u; s++) {
    const g = e[s];
    if (g !== 0) {
      if (o = n[n.length - 1], e[o] < g) {
        t[s] = o, n.push(s);
        continue;
      }
      for (i = 0, l = n.length - 1; i < l; )
        c = i + l >> 1, e[n[c]] < g ? i = c + 1 : l = c;
      g < e[n[i]] && (i > 0 && (t[s] = n[i - 1]), n[i] = s);
    }
  }
  for (i = n.length, l = n[i - 1]; i-- > 0; )
    n[i] = l, l = t[l];
  return n;
}
function Ir(e) {
  const t = e.subTree.component;
  if (t)
    return t.asyncDep && !t.asyncResolved ? t : Ir(t);
}
function oi(e) {
  if (e)
    for (let t = 0; t < e.length; t++)
      e[t].flags |= 8;
}
function Rr(e) {
  if (e.placeholder)
    return e.placeholder;
  const t = e.component;
  return t ? Rr(t.subTree) : null;
}
const Lr = (e) => e.__isSuspense;
function Pc(e, t) {
  t && t.pendingBranch ? Q(e) ? t.effects.push(...e) : t.effects.push(e) : Da(e);
}
const de = /* @__PURE__ */ Symbol.for("v-fgt"), Ps = /* @__PURE__ */ Symbol.for("v-txt"), je = /* @__PURE__ */ Symbol.for("v-cmt"), Vs = /* @__PURE__ */ Symbol.for("v-stc"), Fn = [];
let We = null;
function x(e = !1) {
  Fn.push(We = e ? null : []);
}
function Mc() {
  Fn.pop(), We = Fn[Fn.length - 1] || null;
}
let qn = 1;
function ps(e, t = !1) {
  qn += e, e < 0 && We && t && (We.hasOnce = !0);
}
function Nr(e) {
  return e.dynamicChildren = qn > 0 ? We || dn : null, Mc(), qn > 0 && We && We.push(e), e;
}
function S(e, t, n, s, o, i) {
  return Nr(
    r(
      e,
      t,
      n,
      s,
      o,
      i,
      !0
    )
  );
}
function Tc(e, t, n, s, o) {
  return Nr(
    ke(
      e,
      t,
      n,
      s,
      o,
      !0
    )
  );
}
function vs(e) {
  return e ? e.__v_isVNode === !0 : !1;
}
function Yt(e, t) {
  return e.type === t.type && e.key === t.key;
}
const Or = ({ key: e }) => e ?? null, ls = ({
  ref: e,
  ref_key: t,
  ref_for: n
}) => (typeof e == "number" && (e = "" + e), e != null ? we(e) || /* @__PURE__ */ $e(e) || Y(e) ? { i: Xe, r: e, k: t, f: !!n } : e : null);
function r(e, t = null, n = null, s = 0, o = null, i = e === de ? 0 : 1, l = !1, c = !1) {
  const u = {
    __v_isVNode: !0,
    __v_skip: !0,
    type: e,
    props: t,
    key: t && Or(t),
    ref: t && ls(t),
    scopeId: ir,
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
    dynamicProps: o,
    dynamicChildren: null,
    appContext: null,
    ctx: Xe
  };
  return c ? (Po(u, n), i & 128 && e.normalize(u)) : n && (u.shapeFlag |= we(n) ? 8 : 16), qn > 0 && // avoid a block node from tracking itself
  !l && // has current parent block
  We && // presence of a patch flag indicates this node needs patching on updates.
  // component nodes also should always be patched, because even if the
  // component doesn't need to update, it needs to persist the instance on to
  // the next vnode so that it can be properly unmounted later.
  (u.patchFlag > 0 || i & 6) && // the EVENTS flag is only for hydration and if it is the only flag, the
  // vnode should not be considered dynamic due to handler caching.
  u.patchFlag !== 32 && We.push(u), u;
}
const ke = Ec;
function Ec(e, t = null, n = null, s = 0, o = null, i = !1) {
  if ((!e || e === tc) && (e = je), vs(e)) {
    const c = qt(
      e,
      t,
      !0
      /* mergeRef: true */
    );
    return n && Po(c, n), qn > 0 && !i && We && (c.shapeFlag & 6 ? We[We.indexOf(e)] = c : We.push(c)), c.patchFlag = -2, c;
  }
  if (Bc(e) && (e = e.__vccOpts), t) {
    t = Ic(t);
    let { class: c, style: u } = t;
    c && !we(c) && (t.class = j(c)), le(u) && (/* @__PURE__ */ xo(u) && !Q(u) && (u = Ee({}, u)), t.style = Pt(u));
  }
  const l = we(e) ? 1 : Lr(e) ? 128 : ar(e) ? 64 : le(e) ? 4 : Y(e) ? 2 : 0;
  return r(
    e,
    t,
    n,
    s,
    o,
    l,
    i,
    !0
  );
}
function Ic(e) {
  return e ? /* @__PURE__ */ xo(e) || wr(e) ? Ee({}, e) : e : null;
}
function qt(e, t, n = !1, s = !1) {
  const { props: o, ref: i, patchFlag: l, children: c, transition: u } = e, g = t ? Rc(o || {}, t) : o, p = {
    __v_isVNode: !0,
    __v_skip: !0,
    type: e.type,
    props: g,
    key: g && Or(g),
    ref: t && t.ref ? (
      // #2078 in the case of <component :is="vnode" ref="extra"/>
      // if the vnode itself already has a ref, cloneVNode will need to merge
      // the refs so the single vnode can be set on multiple refs
      n && i ? Q(i) ? i.concat(ls(t)) : [i, ls(t)] : ls(t)
    ) : i,
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
    patchFlag: t && e.type !== de ? l === -1 ? 16 : l | 16 : l,
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
    ssContent: e.ssContent && qt(e.ssContent),
    ssFallback: e.ssFallback && qt(e.ssFallback),
    placeholder: e.placeholder,
    el: e.el,
    anchor: e.anchor,
    ctx: e.ctx,
    ce: e.ce
  };
  return u && s && Vn(
    p,
    u.clone(p)
  ), p;
}
function oo(e = " ", t = 0) {
  return ke(Ps, null, e, t);
}
function B(e = "", t = !1) {
  return t ? (x(), Tc(je, null, e)) : ke(je, null, e);
}
function mt(e) {
  return e == null || typeof e == "boolean" ? ke(je) : Q(e) ? ke(
    de,
    null,
    // #3666, avoid reference pollution when reusing vnode
    e.slice()
  ) : vs(e) ? Mt(e) : ke(Ps, null, String(e));
}
function Mt(e) {
  return e.el === null && e.patchFlag !== -1 || e.memo ? e : qt(e);
}
function Po(e, t) {
  let n = 0;
  const { shapeFlag: s } = e;
  if (t == null)
    t = null;
  else if (Q(t))
    n = 16;
  else if (typeof t == "object")
    if (s & 65) {
      const o = t.default;
      o && (o._c && (o._d = !1), Po(e, o()), o._c && (o._d = !0));
      return;
    } else {
      n = 32;
      const o = t._;
      !o && !wr(t) ? t._ctx = Xe : o === 3 && Xe && (Xe.slots._ === 1 ? t._ = 1 : (t._ = 2, e.patchFlag |= 1024));
    }
  else Y(t) ? (t = { default: t, _ctx: Xe }, n = 32) : (t = String(t), s & 64 ? (n = 16, t = [oo(t)]) : n = 8);
  e.children = t, e.shapeFlag |= n;
}
function Rc(...e) {
  const t = {};
  for (let n = 0; n < e.length; n++) {
    const s = e[n];
    for (const o in s)
      if (o === "class")
        t.class !== s.class && (t.class = j([t.class, s.class]));
      else if (o === "style")
        t.style = Pt([t.style, s.style]);
      else if (ys(o)) {
        const i = t[o], l = s[o];
        l && i !== l && !(Q(i) && i.includes(l)) ? t[o] = i ? [].concat(i, l) : l : l == null && i == null && // mergeProps({ 'onUpdate:modelValue': undefined }) should not retain
        // the model listener.
        !_s(o) && (t[o] = l);
      } else o !== "" && (t[o] = s[o]);
  }
  return t;
}
function dt(e, t, n, s = null) {
  lt(e, t, 7, [
    n,
    s
  ]);
}
const Lc = _r();
let Nc = 0;
function Oc(e, t, n) {
  const s = e.type, o = (t ? t.appContext : e.appContext) || Lc, i = {
    uid: Nc++,
    vnode: e,
    type: s,
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
    scope: new oa(
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
    propsOptions: Ar(s, o),
    emitsOptions: br(s, o),
    // emit
    emit: null,
    // to be set immediately
    emitted: null,
    // props default value
    propsDefaults: ve,
    // inheritAttrs
    inheritAttrs: s.inheritAttrs,
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
  return i.ctx = { _: i }, i.root = t ? t.root : i, i.emit = fc.bind(null, i), e.ce && e.ce(i), i;
}
let Ve = null;
const Dr = () => Ve || Xe;
let gs, io;
{
  const e = xs(), t = (n, s) => {
    let o;
    return (o = e[n]) || (o = e[n] = []), o.push(s), (i) => {
      o.length > 1 ? o.forEach((l) => l(i)) : o[0](i);
    };
  };
  gs = t(
    "__VUE_INSTANCE_SETTERS__",
    (n) => Ve = n
  ), io = t(
    "__VUE_SSR_SETTERS__",
    (n) => Un = n
  );
}
const zn = (e) => {
  const t = Ve;
  return gs(e), e.scope.on(), () => {
    e.scope.off(), gs(t);
  };
}, ii = () => {
  Ve && Ve.scope.off(), gs(null);
};
function $r(e) {
  return e.vnode.shapeFlag & 4;
}
let Un = !1;
function Dc(e, t = !1, n = !1) {
  t && io(t);
  const { props: s, children: o } = e.vnode, i = $r(e);
  mc(e, s, i, t), xc(e, o, n || t);
  const l = i ? $c(e, t) : void 0;
  return t && io(!1), l;
}
function $c(e, t) {
  const n = e.type;
  e.accessCache = /* @__PURE__ */ Object.create(null), e.proxy = new Proxy(e.ctx, nc);
  const { setup: s } = n;
  if (s) {
    Rt();
    const o = e.setupContext = s.length > 1 ? Hc(e) : null, i = zn(e), l = Qn(
      s,
      e,
      0,
      [
        e.props,
        o
      ]
    ), c = Ri(l);
    if (Lt(), i(), (c || e.sp) && !Dn(e) && vr(e), c) {
      if (l.then(ii, ii), t)
        return l.then((u) => {
          ri(e, u);
        }).catch((u) => {
          Cs(u, e, 0);
        });
      e.asyncDep = l;
    } else
      ri(e, l);
  } else
    Fr(e);
}
function ri(e, t, n) {
  Y(t) ? e.type.__ssrInlineRender ? e.ssrRender = t : e.render = t : le(t) && (e.setupState = er(t)), Fr(e);
}
function Fr(e, t, n) {
  const s = e.type;
  e.render || (e.render = s.render || xt);
  {
    const o = zn(e);
    Rt();
    try {
      sc(e);
    } finally {
      Lt(), o();
    }
  }
}
const Fc = {
  get(e, t) {
    return De(e, "get", ""), e[t];
  }
};
function Hc(e) {
  const t = (n) => {
    e.exposed = n || {};
  };
  return {
    attrs: new Proxy(e.attrs, Fc),
    slots: e.slots,
    emit: e.emit,
    expose: t
  };
}
function Ms(e) {
  return e.exposed ? e.exposeProxy || (e.exposeProxy = new Proxy(er(ka(e.exposed)), {
    get(t, n) {
      if (n in t)
        return t[n];
      if (n in $n)
        return $n[n](e);
    },
    has(t, n) {
      return n in t || n in $n;
    }
  })) : e.proxy;
}
function Bc(e) {
  return Y(e) && "__vccOpts" in e;
}
const J = (e, t) => /* @__PURE__ */ Ia(e, t, Un);
function jc(e, t, n) {
  try {
    ps(-1);
    const s = arguments.length;
    return s === 2 ? le(t) && !Q(t) ? vs(t) ? ke(e, null, [t]) : ke(e, t) : ke(e, null, t) : (s > 3 ? n = Array.prototype.slice.call(arguments, 2) : s === 3 && vs(n) && (n = [n]), ke(e, t, n));
  } finally {
    ps(1);
  }
}
const Vc = "3.5.34";
let ro;
const li = typeof window < "u" && window.trustedTypes;
if (li)
  try {
    ro = /* @__PURE__ */ li.createPolicy("vue", {
      createHTML: (e) => e
    });
  } catch {
  }
const Hr = ro ? (e) => ro.createHTML(e) : (e) => e, qc = "http://www.w3.org/2000/svg", Uc = "http://www.w3.org/1998/Math/MathML", At = typeof document < "u" ? document : null, ai = At && /* @__PURE__ */ At.createElement("template"), Kc = {
  insert: (e, t, n) => {
    t.insertBefore(e, n || null);
  },
  remove: (e) => {
    const t = e.parentNode;
    t && t.removeChild(e);
  },
  createElement: (e, t, n, s) => {
    const o = t === "svg" ? At.createElementNS(qc, e) : t === "mathml" ? At.createElementNS(Uc, e) : n ? At.createElement(e, { is: n }) : At.createElement(e);
    return e === "select" && s && s.multiple != null && o.setAttribute("multiple", s.multiple), o;
  },
  createText: (e) => At.createTextNode(e),
  createComment: (e) => At.createComment(e),
  setText: (e, t) => {
    e.nodeValue = t;
  },
  setElementText: (e, t) => {
    e.textContent = t;
  },
  parentNode: (e) => e.parentNode,
  nextSibling: (e) => e.nextSibling,
  querySelector: (e) => At.querySelector(e),
  setScopeId(e, t) {
    e.setAttribute(t, "");
  },
  // __UNSAFE__
  // Reason: innerHTML.
  // Static content here can only come from compiled templates.
  // As long as the user only uses trusted templates, this is safe.
  insertStaticContent(e, t, n, s, o, i) {
    const l = n ? n.previousSibling : t.lastChild;
    if (o && (o === i || o.nextSibling))
      for (; t.insertBefore(o.cloneNode(!0), n), !(o === i || !(o = o.nextSibling)); )
        ;
    else {
      ai.innerHTML = Hr(
        s === "svg" ? `<svg>${e}</svg>` : s === "mathml" ? `<math>${e}</math>` : e
      );
      const c = ai.content;
      if (s === "svg" || s === "mathml") {
        const u = c.firstChild;
        for (; u.firstChild; )
          c.appendChild(u.firstChild);
        c.removeChild(u);
      }
      t.insertBefore(c, n);
    }
    return [
      // first
      l ? l.nextSibling : t.firstChild,
      // last
      n ? n.previousSibling : t.lastChild
    ];
  }
}, jt = "transition", An = "animation", Kn = /* @__PURE__ */ Symbol("_vtc"), Br = {
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
}, Wc = /* @__PURE__ */ Ee(
  {},
  cr,
  Br
), Qc = (e) => (e.displayName = "Transition", e.props = Wc, e), wt = /* @__PURE__ */ Qc(
  (e, { slots: t }) => jc(Ua, zc(e), t)
), Wt = (e, t = []) => {
  Q(e) ? e.forEach((n) => n(...t)) : e && e(...t);
}, ci = (e) => e ? Q(e) ? e.some((t) => t.length > 1) : e.length > 1 : !1;
function zc(e) {
  const t = {};
  for (const D in e)
    D in Br || (t[D] = e[D]);
  if (e.css === !1)
    return t;
  const {
    name: n = "v",
    type: s,
    duration: o,
    enterFromClass: i = `${n}-enter-from`,
    enterActiveClass: l = `${n}-enter-active`,
    enterToClass: c = `${n}-enter-to`,
    appearFromClass: u = i,
    appearActiveClass: g = l,
    appearToClass: p = c,
    leaveFromClass: m = `${n}-leave-from`,
    leaveActiveClass: k = `${n}-leave-active`,
    leaveToClass: T = `${n}-leave-to`
  } = e, $ = Gc(o), M = $ && $[0], K = $ && $[1], {
    onBeforeEnter: X,
    onEnter: z,
    onEnterCancelled: F,
    onLeave: H,
    onLeaveCancelled: se,
    onBeforeAppear: be = X,
    onAppear: ae = z,
    onAppearCancelled: Ne = F
  } = t, G = (D, ge, Me, Ze) => {
    D._enterCancelled = Ze, Qt(D, ge ? p : c), Qt(D, ge ? g : l), Me && Me();
  }, ee = (D, ge) => {
    D._isLeaving = !1, Qt(D, m), Qt(D, T), Qt(D, k), ge && ge();
  }, ye = (D) => (ge, Me) => {
    const Ze = D ? ae : z, Ce = () => G(ge, D, Me);
    Wt(Ze, [ge, Ce]), ui(() => {
      Qt(ge, D ? u : i), kt(ge, D ? p : c), ci(Ze) || fi(ge, s, M, Ce);
    });
  };
  return Ee(t, {
    onBeforeEnter(D) {
      Wt(X, [D]), kt(D, i), kt(D, l);
    },
    onBeforeAppear(D) {
      Wt(be, [D]), kt(D, u), kt(D, g);
    },
    onEnter: ye(!1),
    onAppear: ye(!0),
    onLeave(D, ge) {
      D._isLeaving = !0;
      const Me = () => ee(D, ge);
      kt(D, m), D._enterCancelled ? (kt(D, k), vi(D)) : (vi(D), kt(D, k)), ui(() => {
        D._isLeaving && (Qt(D, m), kt(D, T), ci(H) || fi(D, s, K, Me));
      }), Wt(H, [D, Me]);
    },
    onEnterCancelled(D) {
      G(D, !1, void 0, !0), Wt(F, [D]);
    },
    onAppearCancelled(D) {
      G(D, !0, void 0, !0), Wt(Ne, [D]);
    },
    onLeaveCancelled(D) {
      ee(D), Wt(se, [D]);
    }
  });
}
function Gc(e) {
  if (e == null)
    return null;
  if (le(e))
    return [qs(e.enter), qs(e.leave)];
  {
    const t = qs(e);
    return [t, t];
  }
}
function qs(e) {
  return Yl(e);
}
function kt(e, t) {
  t.split(/\s+/).forEach((n) => n && e.classList.add(n)), (e[Kn] || (e[Kn] = /* @__PURE__ */ new Set())).add(t);
}
function Qt(e, t) {
  t.split(/\s+/).forEach((s) => s && e.classList.remove(s));
  const n = e[Kn];
  n && (n.delete(t), n.size || (e[Kn] = void 0));
}
function ui(e) {
  requestAnimationFrame(() => {
    requestAnimationFrame(e);
  });
}
let Yc = 0;
function fi(e, t, n, s) {
  const o = e._endId = ++Yc, i = () => {
    o === e._endId && s();
  };
  if (n != null)
    return setTimeout(i, n);
  const { type: l, timeout: c, propCount: u } = Xc(e, t);
  if (!l)
    return s();
  const g = l + "end";
  let p = 0;
  const m = () => {
    e.removeEventListener(g, k), i();
  }, k = (T) => {
    T.target === e && ++p >= u && m();
  };
  setTimeout(() => {
    p < u && m();
  }, c + 1), e.addEventListener(g, k);
}
function Xc(e, t) {
  const n = window.getComputedStyle(e), s = ($) => (n[$] || "").split(", "), o = s(`${jt}Delay`), i = s(`${jt}Duration`), l = di(o, i), c = s(`${An}Delay`), u = s(`${An}Duration`), g = di(c, u);
  let p = null, m = 0, k = 0;
  t === jt ? l > 0 && (p = jt, m = l, k = i.length) : t === An ? g > 0 && (p = An, m = g, k = u.length) : (m = Math.max(l, g), p = m > 0 ? l > g ? jt : An : null, k = p ? p === jt ? i.length : u.length : 0);
  const T = p === jt && /\b(?:transform|all)(?:,|$)/.test(
    s(`${jt}Property`).toString()
  );
  return {
    type: p,
    timeout: m,
    propCount: k,
    hasTransform: T
  };
}
function di(e, t) {
  for (; e.length < t.length; )
    e = e.concat(e);
  return Math.max(...t.map((n, s) => pi(n) + pi(e[s])));
}
function pi(e) {
  return e === "auto" ? 0 : Number(e.slice(0, -1).replace(",", ".")) * 1e3;
}
function vi(e) {
  return (e ? e.ownerDocument : document).body.offsetHeight;
}
function Jc(e, t, n) {
  const s = e[Kn];
  s && (t = (t ? [t, ...s] : [...s]).join(" ")), t == null ? e.removeAttribute("class") : n ? e.setAttribute("class", t) : e.className = t;
}
const hs = /* @__PURE__ */ Symbol("_vod"), jr = /* @__PURE__ */ Symbol("_vsh"), Pn = {
  // used for prop mismatch check during hydration
  name: "show",
  beforeMount(e, { value: t }, { transition: n }) {
    e[hs] = e.style.display === "none" ? "" : e.style.display, n && t ? n.beforeEnter(e) : Mn(e, t);
  },
  mounted(e, { value: t }, { transition: n }) {
    n && t && n.enter(e);
  },
  updated(e, { value: t, oldValue: n }, { transition: s }) {
    !t != !n && (s ? t ? (s.beforeEnter(e), Mn(e, !0), s.enter(e)) : s.leave(e, () => {
      Mn(e, !1);
    }) : Mn(e, t));
  },
  beforeUnmount(e, { value: t }) {
    Mn(e, t);
  }
};
function Mn(e, t) {
  e.style.display = t ? e[hs] : "none", e[jr] = !t;
}
const Zc = /* @__PURE__ */ Symbol(""), eu = /(?:^|;)\s*display\s*:/;
function tu(e, t, n) {
  const s = e.style, o = we(n);
  let i = !1;
  if (n && !o) {
    if (t)
      if (we(t))
        for (const l of t.split(";")) {
          const c = l.slice(0, l.indexOf(":")).trim();
          n[c] == null && En(s, c, "");
        }
      else
        for (const l in t)
          n[l] == null && En(s, l, "");
    for (const l in n) {
      l === "display" && (i = !0);
      const c = n[l];
      c != null ? su(
        e,
        l,
        !we(t) && t ? t[l] : void 0,
        c
      ) || En(s, l, c) : En(s, l, "");
    }
  } else if (o) {
    if (t !== n) {
      const l = s[Zc];
      l && (n += ";" + l), s.cssText = n, i = eu.test(n);
    }
  } else t && e.removeAttribute("style");
  hs in e && (e[hs] = i ? s.display : "", e[jr] && (s.display = "none"));
}
const gi = /\s*!important$/;
function En(e, t, n) {
  if (Q(n))
    n.forEach((s) => En(e, t, s));
  else if (n == null && (n = ""), t.startsWith("--"))
    e.setProperty(t, n);
  else {
    const s = nu(e, t);
    gi.test(n) ? e.setProperty(
      en(s),
      n.replace(gi, ""),
      "important"
    ) : e[s] = n;
  }
}
const hi = ["Webkit", "Moz", "ms"], Us = {};
function nu(e, t) {
  const n = Us[t];
  if (n)
    return n;
  let s = ot(t);
  if (s !== "filter" && s in e)
    return Us[t] = s;
  s = Oi(s);
  for (let o = 0; o < hi.length; o++) {
    const i = hi[o] + s;
    if (i in e)
      return Us[t] = i;
  }
  return t;
}
function su(e, t, n, s) {
  return e.tagName === "TEXTAREA" && (t === "width" || t === "height") && we(s) && n === s;
}
const mi = "http://www.w3.org/1999/xlink";
function yi(e, t, n, s, o, i = na(t)) {
  s && t.startsWith("xlink:") ? n == null ? e.removeAttributeNS(mi, t.slice(6, t.length)) : e.setAttributeNS(mi, t, n) : n == null || i && !$i(n) ? e.removeAttribute(t) : e.setAttribute(
    t,
    i ? "" : St(n) ? String(n) : n
  );
}
function _i(e, t, n, s, o) {
  if (t === "innerHTML" || t === "textContent") {
    n != null && (e[t] = t === "innerHTML" ? Hr(n) : n);
    return;
  }
  const i = e.tagName;
  if (t === "value" && i !== "PROGRESS" && // custom elements may use _value internally
  !i.includes("-")) {
    const c = i === "OPTION" ? e.getAttribute("value") || "" : e.value, u = n == null ? (
      // #11647: value should be set as empty string for null and undefined,
      // but <input type="checkbox"> should be set as 'on'.
      e.type === "checkbox" ? "on" : ""
    ) : String(n);
    (c !== u || !("_value" in e)) && (e.value = u), n == null && e.removeAttribute(t), e._value = n;
    return;
  }
  let l = !1;
  if (n === "" || n == null) {
    const c = typeof e[t];
    c === "boolean" ? n = $i(n) : n == null && c === "string" ? (n = "", l = !0) : c === "number" && (n = 0, l = !0);
  }
  try {
    e[t] = n;
  } catch {
  }
  l && e.removeAttribute(o || t);
}
function ou(e, t, n, s) {
  e.addEventListener(t, n, s);
}
function iu(e, t, n, s) {
  e.removeEventListener(t, n, s);
}
const bi = /* @__PURE__ */ Symbol("_vei");
function ru(e, t, n, s, o = null) {
  const i = e[bi] || (e[bi] = {}), l = i[t];
  if (s && l)
    l.value = s;
  else {
    const [c, u] = lu(t);
    if (s) {
      const g = i[t] = uu(
        s,
        o
      );
      ou(e, c, g, u);
    } else l && (iu(e, c, l, u), i[t] = void 0);
  }
}
const xi = /(?:Once|Passive|Capture)$/;
function lu(e) {
  let t;
  if (xi.test(e)) {
    t = {};
    let s;
    for (; s = e.match(xi); )
      e = e.slice(0, e.length - s[0].length), t[s[0].toLowerCase()] = !0;
  }
  return [e[2] === ":" ? e.slice(3) : en(e.slice(2)), t];
}
let Ks = 0;
const au = /* @__PURE__ */ Promise.resolve(), cu = () => Ks || (au.then(() => Ks = 0), Ks = Date.now());
function uu(e, t) {
  const n = (s) => {
    if (!s._vts)
      s._vts = Date.now();
    else if (s._vts <= n.attached)
      return;
    lt(
      fu(s, n.value),
      t,
      5,
      [s]
    );
  };
  return n.value = e, n.attached = cu(), n;
}
function fu(e, t) {
  if (Q(t)) {
    const n = e.stopImmediatePropagation;
    return e.stopImmediatePropagation = () => {
      n.call(e), e._stopped = !0;
    }, t.map(
      (s) => (o) => !o._stopped && s && s(o)
    );
  } else
    return t;
}
const Si = (e) => e.charCodeAt(0) === 111 && e.charCodeAt(1) === 110 && // lowercase letter
e.charCodeAt(2) > 96 && e.charCodeAt(2) < 123, du = (e, t, n, s, o, i) => {
  const l = o === "svg";
  t === "class" ? Jc(e, s, l) : t === "style" ? tu(e, n, s) : ys(t) ? _s(t) || ru(e, t, n, s, i) : (t[0] === "." ? (t = t.slice(1), !0) : t[0] === "^" ? (t = t.slice(1), !1) : pu(e, t, s, l)) ? (_i(e, t, s), !e.tagName.includes("-") && (t === "value" || t === "checked" || t === "selected") && yi(e, t, s, l, i, t !== "value")) : /* #11081 force set props for possible async custom element */ e._isVueCE && // #12408 check if it's declared prop or it's async custom element
  (vu(e, t) || // @ts-expect-error _def is private
  e._def.__asyncLoader && (/[A-Z]/.test(t) || !we(s))) ? _i(e, ot(t), s, i, t) : (t === "true-value" ? e._trueValue = s : t === "false-value" && (e._falseValue = s), yi(e, t, s, l));
};
function pu(e, t, n, s) {
  if (s)
    return !!(t === "innerHTML" || t === "textContent" || t in e && Si(t) && Y(n));
  if (t === "spellcheck" || t === "draggable" || t === "translate" || t === "autocorrect" || t === "sandbox" && e.tagName === "IFRAME" || t === "form" || t === "list" && e.tagName === "INPUT" || t === "type" && e.tagName === "TEXTAREA")
    return !1;
  if (t === "width" || t === "height") {
    const o = e.tagName;
    if (o === "IMG" || o === "VIDEO" || o === "CANVAS" || o === "SOURCE")
      return !1;
  }
  return Si(t) && we(n) ? !1 : t in e;
}
function vu(e, t) {
  const n = (
    // @ts-expect-error _def is private
    e._def.props
  );
  if (!n)
    return !1;
  const s = ot(t);
  return Array.isArray(n) ? n.some((o) => ot(o) === s) : Object.keys(n).some((o) => ot(o) === s);
}
const gu = ["ctrl", "shift", "alt", "meta"], hu = {
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
  exact: (e, t) => gu.some((n) => e[`${n}Key`] && !t.includes(n))
}, _e = (e, t) => {
  if (!e) return e;
  const n = e._withMods || (e._withMods = {}), s = t.join(".");
  return n[s] || (n[s] = ((o, ...i) => {
    for (let l = 0; l < t.length; l++) {
      const c = hu[t[l]];
      if (c && c(o, t)) return;
    }
    return e(o, ...i);
  }));
}, mu = /* @__PURE__ */ Ee({ patchProp: du }, Kc);
let Ci;
function yu() {
  return Ci || (Ci = Cc(mu));
}
const _u = ((...e) => {
  const t = yu().createApp(...e), { mount: n } = t;
  return t.mount = (s) => {
    const o = xu(s);
    if (!o) return;
    const i = t._component;
    !Y(i) && !i.render && !i.template && (i.template = o.innerHTML), o.nodeType === 1 && (o.textContent = "");
    const l = n(o, !1, bu(o));
    return o instanceof Element && (o.removeAttribute("v-cloak"), o.setAttribute("data-v-app", "")), l;
  }, t;
});
function bu(e) {
  if (e instanceof SVGElement)
    return "svg";
  if (typeof MathMLElement == "function" && e instanceof MathMLElement)
    return "mathml";
}
function xu(e) {
  return we(e) ? document.querySelector(e) : e;
}
function Z() {
  return typeof window < "u" && window.openxnetApp || null;
}
function Vr(e) {
  if (e && typeof e.isCurrentLanguageZh == "function")
    try {
      return !!e.isCurrentLanguageZh();
    } catch {
      return !0;
    }
  return String(e?.currentLanguage || navigator.language || "zh-CN").toLowerCase().startsWith("zh");
}
function Su(e) {
  return String(e || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function wi(e) {
  return Su(e).replace(/\n/g, "<br>");
}
const Xt = /* @__PURE__ */ new Map(), Cu = 80, hn = /* @__PURE__ */ new Map(), wu = 24;
function Ws() {
  for (; Xt.size > Cu; ) {
    const e = Xt.keys().next().value;
    Xt.delete(e);
  }
}
function ku() {
  for (; hn.size > wu; ) {
    const e = hn.keys().next().value;
    hn.delete(e);
  }
}
function Au() {
  return typeof performance < "u" && typeof performance.now == "function" ? performance.now() : Date.now();
}
function Pu(e, t, n) {
  const s = String(t || ""), o = String(e || "streaming-message");
  if (!n || !s)
    return hn.delete(o), s;
  const i = Au();
  let l = hn.get(o);
  if (!l || !s.startsWith(l.raw || ""))
    return l = {
      raw: s,
      visibleLength: Math.min(s.length, 24),
      updatedAt: i
    }, hn.set(o, l), ku(), s.slice(0, l.visibleLength);
  l.raw = s;
  const c = Math.max(0, s.length - l.visibleLength);
  if (c <= 0)
    return l.updatedAt = i, s;
  const u = Math.max(16, Math.min(180, i - l.updatedAt)), g = c > 2e3 ? 1800 : c > 600 ? 900 : 360, p = c > 600 ? 120 : 32, m = Math.max(4, Math.min(p, Math.ceil(g * u / 1e3)));
  return l.visibleLength = Math.min(s.length, l.visibleLength + m), l.updatedAt = i, s.slice(0, l.visibleLength);
}
function Mo(e) {
  return String(e || "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}
function Ke(e) {
  return Array.isArray(e) ? e : [];
}
function Mu(e, t, n, s, o = 2) {
  let i = "";
  try {
    e && typeof e.getRoleMemoryAvatarText == "function" && (i = String(e.getRoleMemoryAvatarText(t) || "").trim());
  } catch {
    i = "";
  }
  return i || (i = String(n || "").trim() || (s ? "角" : "R")), Array.from(i.replace(/\s+/g, "")).slice(0, o).join("").toUpperCase() || (s ? "角" : "R");
}
function Tu(e, t) {
  try {
    if (e && typeof e.getRoleMemoryAvatarStyle == "function") {
      const n = e.getRoleMemoryAvatarStyle(t);
      if (n?.background)
        return n.background;
    }
  } catch {
  }
  return "linear-gradient(135deg, #73c4ea 0%, #5aa7d1 100%)";
}
function bt(e) {
  return String(e || "").trim();
}
function It(e) {
  return bt(e).replace(/[\\/]+$/, "").toLowerCase();
}
function ki(e) {
  return e ? "实时对话" : "Live Chat";
}
function ms(e) {
  return e ? "未选择模型" : "No model";
}
function lo(e, t) {
  try {
    if (e && typeof e.getProviderModelOptionValue == "function")
      return String(e.getProviderModelOptionValue(t) || "").trim();
  } catch {
  }
  return t && typeof t == "object" ? String(t.id || t.value || t.model || t.name || t.label || "").trim() : String(t || "").trim();
}
function Ai(e, t) {
  try {
    if (e && typeof e.getProviderModelOptionLabel == "function")
      return String(e.getProviderModelOptionLabel(t) || "").trim();
  } catch {
  }
  return t && typeof t == "object" ? String(t.label || t.name || t.id || t.value || t.model || "").trim() : String(t || "").trim();
}
function qr(e) {
  if (!e) return null;
  try {
    if (typeof e.getPrototypeCurrentMainProvider == "function") {
      const s = e.getPrototypeCurrentMainProvider();
      if (s) return s;
    }
  } catch {
  }
  try {
    if (typeof e.findModelProviderById == "function")
      return e.findModelProviderById(e?.settings?.selectedProvider) || null;
  } catch {
  }
  const t = Ke(e?.modelProviders), n = String(e?.settings?.selectedProvider || "").trim();
  return t.find((s) => String(s?.id || "").trim() === n) || t[0] || null;
}
function Eu(e, t) {
  if (!e)
    return {
      providers: [],
      currentProvider: null,
      configuredCount: 0
    };
  let n = [];
  try {
    typeof e.getPrototypeModelProviderCards == "function" ? n = e.getPrototypeModelProviderCards() || [] : n = Ke(e.modelProviders);
  } catch {
    n = Ke(e.modelProviders);
  }
  const s = String(e?.settings?.selectedProvider || "").trim(), o = qr(e), i = n.map((c, u) => {
    const g = String(c?.id || `provider-${u}`);
    let p = String(c?.displayVendor || c?.vendor || "").trim(), m = "", k = String(c?.summaryText || "").trim(), T = "";
    try {
      typeof e.getPrototypeProviderDisplayName == "function" && (p = String(e.getPrototypeProviderDisplayName(c) || p).trim());
    } catch {
    }
    try {
      typeof e.getPrototypeProviderLogo == "function" ? m = String(e.getPrototypeProviderLogo(c) || "").trim() : typeof e.getProviderDisplayLogo == "function" && (m = String(e.getProviderDisplayLogo(c) || "").trim());
    } catch {
    }
    try {
      typeof e.getPrototypeProviderSummaryText == "function" && (k = String(e.getPrototypeProviderSummaryText(c) || k).trim());
    } catch {
    }
    try {
      typeof e.getPrototypeProviderStatusLabel == "function" && (T = String(e.getPrototypeProviderStatusLabel(c) || "").trim());
    } catch {
    }
    let $ = {
      status: "",
      message: "",
      models: []
    };
    try {
      typeof e.getProviderCardValidation == "function" && ($ = e.getProviderCardValidation(g) || $);
    } catch {
      $ = {
        status: "",
        message: "",
        models: []
      };
    }
    const M = Ke($?.models).map((F) => ({
      value: lo(e, F),
      label: Ai(e, F)
    })).filter((F) => F.value), K = Ke(c?.models).map((F) => ({
      value: lo(e, F),
      label: Ai(e, F)
    })).filter((F) => F.value), X = String(c?.modelId || c?.model || "").trim(), z = c?.isTemplate ? !!(o && String(o?.id || "") === g) : s ? g === s : !!(o && String(o?.id || "") === g);
    return {
      id: g,
      name: p || (t ? "未命名服务商" : "Unnamed provider"),
      vendor: String(c?.vendor || "").trim(),
      logo: m,
      summary: k,
      modelId: X,
      models: K,
      validationStatus: String($?.status || "").trim(),
      validationMessage: String($?.message || "").trim(),
      validationChecks: Ke($?.checks),
      matchedModel: !!$?.matched_model,
      apiKeyConfigured: !!$?.api_key_configured,
      apiKeyOptional: !!$?.api_key_optional,
      validationModels: M,
      isValidating: !!e?.providerCardValidatingById?.[g],
      isApplying: !!e?.providerCardApplyingById?.[g],
      isActive: z,
      isTemplate: !!c?.isTemplate,
      statusLabel: T || (c?.isTemplate ? t ? "模板" : "Template" : t ? "已配置" : "Configured")
    };
  }), l = i.filter((c) => {
    if (c.isTemplate) return !1;
    const u = String(c.vendor || "").trim().length > 0 && c.name !== (t ? "未命名服务商" : "Unnamed provider") && c.name !== (t ? "供应商" : "Provider"), g = !!c.modelId || Array.isArray(c.models) && c.models.length > 0, p = !!c.apiKeyConfigured;
    return u && (g || p);
  });
  return {
    providers: l,
    currentProvider: o ? l.find((c) => String(c.id) === String(o?.id || "")) || i.find((c) => String(c.id) === String(o?.id || "")) || {
      id: String(o?.id || ""),
      name: String(o?.displayVendor || o?.vendor || (t ? "当前服务商" : "Current provider")),
      vendor: String(o?.vendor || ""),
      logo: "",
      summary: "",
      modelId: String(o?.modelId || o?.model || ""),
      models: [],
      validationStatus: "",
      validationMessage: "",
      validationChecks: [],
      matchedModel: !1,
      apiKeyConfigured: !1,
      apiKeyOptional: !1,
      validationModels: [],
      isValidating: !1,
      isApplying: !1,
      isActive: !0,
      isTemplate: !!o?.isTemplate,
      statusLabel: o?.isTemplate ? t ? "模板" : "Template" : t ? "当前服务商" : "Current"
    } : null,
    configuredCount: l.length
  };
}
function Iu(e, t) {
  const n = e?.memorySettings || {}, s = String(n.selectedMemory || "").trim(), o = Ke(e?.memories).map((l, c) => {
    const u = String(l?.id || "").trim(), g = String(l?.name || "").trim() || (t ? `未命名角色 ${c + 1}` : `Untitled role ${c + 1}`), p = String(l?.description || l?.personality || l?.note || "").trim(), m = Mu(e, l, g, t, 2);
    return {
      id: u,
      name: g,
      desc: p || (t ? "选择后会作为当前对话角色卡使用" : "Use this role card for the current chat"),
      tag: l?.infer ? t ? "自动学习" : "Learning" : t ? "角色档案" : "Profile",
      initial: m,
      avatarText: m,
      avatarImage: String(l?.avatar || "").trim(),
      avatarBackground: Tu(e, l)
    };
  }).filter((l) => l.id), i = o.find((l) => String(l.id) === s) || null;
  return {
    cards: o,
    selectedId: i ? i.id : "",
    selectedName: i ? i.name : t ? "未启用角色卡" : "No role card",
    selectedAvatarText: i ? i.avatarText : t ? "角" : "AI",
    selectedAvatarImage: i ? i.avatarImage : "",
    selectedAvatarBackground: i ? i.avatarBackground : "linear-gradient(135deg, #5BA3C5, #7BB8D4)",
    enabled: !!n.is_memory && !!i,
    available: o.length > 0 || typeof e?.openChatRoleCardPanel == "function" || typeof e?.selectRoleMemory == "function"
  };
}
function Ru(e, t) {
  if (!e) return ki(t);
  try {
    if (e.conversationId && typeof e.getPrototypeConversationTitle == "function") {
      const n = e.getPrototypeConversationTitle({
        id: e.conversationId,
        title: e.currentConversation?.title || "",
        messages: e.messages || []
      });
      if (n && String(n).trim()) return String(n);
    }
  } catch {
  }
  return ki(t);
}
function Lu(e, t = "") {
  const n = String(e?.prototypeTime || e?.time || "").trim();
  if (n) return n;
  const s = e?.timestamp || e?.created_at || "";
  if (!s) return t;
  try {
    const o = new Date(s);
    return Number.isNaN(o.getTime()) ? String(s) : o.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return String(s);
  }
}
function Nu(e) {
  return !e || !Array.isArray(e.messages) ? !1 : e.messages.some((t, n) => t?.role === "system" && n === 0 ? !1 : String(t?.content || "").trim().length > 0 || t?.role === "assistant" && e.isTyping || t?.role === "assistant" && Array.isArray(t?.activityLog) && t.activityLog.length > 0);
}
function Ou(e, t, n, s = n, o = "") {
  const i = String(t || "");
  if (!i.trim()) return "";
  const l = `${String(s || n)}::${String(o || "")}`, c = Xt.get(l);
  if (c && c.raw === i)
    return c.html;
  let u = "";
  try {
    if (e && typeof e.formatMessage == "function") {
      const g = e.formatMessage.call(e, i, n);
      if (g && String(g).trim())
        return u = String(g), Xt.set(l, { raw: i, html: u }), Ws(), u;
    }
  } catch {
    return u = wi(i), Xt.set(l, { raw: i, html: u }), Ws(), u;
  }
  return u = wi(i), Xt.set(l, { raw: i, html: u }), Ws(), u;
}
function Ur(e) {
  const t = String(e || "");
  if (!t.includes("highlight-block")) return t;
  try {
    if (typeof document < "u") {
      const n = document.createElement("div");
      return n.innerHTML = t, n.querySelectorAll(".highlight-block, .highlight-block-error").forEach((s) => s.remove()), n.innerHTML;
    }
  } catch {
  }
  return t.replace(/<div[^>]*class="[^"]*\bhighlight-block\b[^"]*"[\s\S]*?<\/div>\s*/gi, "").replace(/<div[^>]*class="[^"]*\bhighlight-block-error\b[^"]*"[\s\S]*?<\/div>\s*/gi, "");
}
function Du(e) {
  const t = String(e || "").replace(/\r\n/g, `
`), n = [];
  let s = "";
  for (const o of t)
    s += o, `。！？!?；;：:
`.includes(o) && (n.push(s), s = "");
  return s && n.push(s), n;
}
function $u(e) {
  return Mo(e).replace(/[`*_#>[\](){}"'“”‘’]/g, "").replace(/\s+/g, "").trim().toLowerCase();
}
function Kr(e) {
  const t = String(e || "");
  if (!t.trim()) return t;
  const n = Du(t);
  if (n.length < 4) return t;
  const s = /* @__PURE__ */ new Map(), o = [];
  let i = 0;
  for (const l of n) {
    const c = $u(l), u = c.length >= 14, g = s.get(c) || 0;
    if (u && g > 0) {
      i += 1, s.set(c, g + 1);
      continue;
    }
    c && s.set(c, g + 1), o.push(l);
  }
  return i < 2 ? t : o.join("").replace(/\n{3,}/g, `

`).trim();
}
function Fu(e, t = !1) {
  const n = t ? Ur(e) : String(e || "");
  return Kr(n);
}
function Hu(e) {
  const t = Ur(String(e || "")).replace(/<div[^>]*class="[^"]*\bhighlight-block-reasoning\b[^"]*"[^>]*>/gi, "").replace(/<\/div>/gi, " "), n = Mo(t), s = Kr(n).replace(/\s+/g, " ").trim(), o = 42, i = Array.from(s);
  return i.length > o ? `${i.slice(0, o).join("")}...` : s;
}
function Qs(e) {
  const t = Math.max(0, Math.round(Number(e || 0) / 1e3));
  if (t < 60) return `${t}s`;
  const n = Math.floor(t / 60), s = String(t % 60).padStart(2, "0");
  return `${n}m ${s}s`;
}
function un(e) {
  const t = Number(e || 0);
  return Number.isFinite(t) && t > 0 ? t : 0;
}
function Bu(e, t, n, s) {
  if (!t || t.role !== "assistant")
    return { visible: !1, steps: [], signature: "" };
  const o = Date.now(), i = Array.isArray(t.activityLog) ? t.activityLog : [];
  if (!(i.length > 0 || !!e?.isTyping && n))
    return { visible: !1, steps: [], signature: "" };
  const c = un(t.activityStartedAt) || un(t.createdAt) || un(t.id) || o, u = un(t.activityEndedAt), g = !!e?.isTyping && n && !t.generationFinished, p = (u || o) - c, m = {
    id: "assistant-thinking",
    kind: "thinking",
    status: g ? "running" : "done",
    label: g ? s ? "正在" : "Now" : s ? "已完成" : "Done",
    title: g ? s ? "思考下一步" : "Thinking about the next step" : s ? "完成回复" : "Finished",
    startedAt: c,
    updatedAt: o,
    endedAt: g ? null : u || o
  }, T = (i.length ? i : [m]).map((M, K) => {
    const X = un(M?.startedAt) || c, z = un(M?.endedAt), F = String(M?.status || "running"), H = z && z >= X ? Qs(z - X) : "";
    return {
      id: String(M?.id || `activity-${K}`),
      kind: String(M?.kind || "status"),
      status: F,
      label: String(M?.label || (F === "running" ? s ? "正在" : "Now" : s ? "已完成" : "Done")),
      title: String(M?.title || "").trim(),
      detail: String(M?.detail || "").trim(),
      duration: H,
      order: K,
      running: F === "running"
    };
  }).filter((M) => M.title || M.label).slice().sort((M, K) => M.kind === "thinking" && K.kind !== "thinking" ? 1 : M.kind !== "thinking" && K.kind === "thinking" ? -1 : M.order - K.order).slice(-8), $ = [
    Math.floor(p / 1e3),
    g ? "active" : "done",
    ...T.map((M) => [M.id, M.status, M.label, M.title, M.detail, M.duration].join(":"))
  ].join("|");
  return {
    visible: T.length > 0,
    active: g || T.some((M) => M.running),
    elapsedLabel: s ? `已处理 ${Qs(p)}` : `Processed ${Qs(p)}`,
    steps: T,
    signature: $
  };
}
function ju(e) {
  const t = (e?.messages || []).filter((s, o) => !(s?.role === "system" && o === 0)), n = Vr(e);
  return t.map((s, o) => {
    const i = s?.role === "assistant" ? "assistant" : "user", l = o === t.length - 1, c = Bu(e, s, l, n), u = String(s?.pure_content || s?.content || ""), g = s?.id || `live-${o}`, p = i === "assistant" && l && !!e?.isTyping && !s?.generationFinished, m = i === "assistant" ? Pu(g, u, p) : u, k = i === "assistant" ? Fu(m, c.visible) : u, T = [
      n ? "zh" : "en",
      l && e?.isTyping ? "typing" : "idle",
      s?.generationFinished ? "done" : "open",
      c.visible ? "activity" : "plain"
    ].join(":");
    return {
      id: String(s?.id || `live-${o}`),
      role: i,
      text: i === "user" ? Mo(u) : "",
      html: i === "assistant" ? Ou(e, k, o, g, T) : "",
      typing: i === "assistant" && !String(u || "").trim() && !!e?.isTyping && l,
      time: Lu(s),
      activity: c
    };
  });
}
function Vu(e) {
  return e ? "从输入框开始你的第一条消息，AI 助手会立刻回应。" : "Send your first message to start chatting with the assistant.";
}
function qu(e, t) {
  if (!e)
    return {
      model: ms(t),
      providerName: t ? "未选择服务商" : "No provider",
      temperature: 0.7,
      maxTokens: 8192,
      maxTokensOptions: [1024, 2048, 4096, 8192, 16384, 32768],
      systemPrompt: "",
      memoryEnabled: !1,
      memoryAvailable: !1,
      interpreterEnabled: !1,
      asrEnabled: !1,
      webSearchEnabled: !1,
      browserControlEnabled: !1,
      browserControlAvailable: !1,
      ttsEnabled: !1,
      ttsAvailable: !1,
      desktopVisionEnabled: !1,
      desktopVisionAvailable: !1,
      screenshotAvailable: !1,
      tablePetAvailable: !1,
      roleCardAvailable: !1,
      roleCardEnabled: !1,
      roleCardName: t ? "未启用角色卡" : "No role card",
      roleCardSelectedId: "",
      roleCardAvatarText: "AI",
      roleCardAvatarImage: "",
      roleCardAvatarBackground: "linear-gradient(135deg, #5BA3C5, #7BB8D4)",
      roleCards: [],
      isElectron: !1
    };
  const n = e.settings || {}, s = e.memorySettings || {}, o = e.codeSettings || {}, i = e.asrSettings || {}, l = e.webSearchSettings || {}, c = e.chromeMCPSettings || {}, u = e.ttsSettings || {}, g = e.visionSettings || {}, p = Array.isArray(e.MoreButtonDict) ? e.MoreButtonDict : [], m = (X) => !!p.find((F) => F && F.name === X)?.enabled, k = Number(n.temperature), T = Number(n.max_tokens), $ = Eu(e, t), M = $.currentProvider, K = Iu(e, t);
  return {
    model: String(n.model || "").trim() || ms(t),
    providerName: String(M?.name || (t ? "未选择服务商" : "No provider")).trim(),
    providerLogo: String(M?.logo || "").trim(),
    providerSummary: String(M?.summary || "").trim(),
    providerId: String(M?.id || n.selectedProvider || "").trim(),
    providerCards: $.providers,
    configuredProviderCount: Number($.configuredCount || 0),
    temperature: Number.isFinite(k) ? k : 0.7,
    maxTokens: Number.isFinite(T) && T > 0 ? T : 8192,
    maxTokensOptions: [1024, 2048, 4096, 8192, 16384, 32768],
    systemPrompt: String(e.system_prompt || "").trim(),
    memoryEnabled: !!s.is_memory,
    memoryAvailable: typeof s.is_memory == "boolean",
    interpreterEnabled: !!o.enabled,
    asrEnabled: !!i.enabled,
    webSearchEnabled: !!l.enabled,
    browserControlEnabled: !!c.enabled,
    browserControlAvailable: !!e.isElectron,
    ttsEnabled: !!u.enabled,
    ttsAvailable: m("ttsButton"),
    desktopVisionEnabled: !!g.desktopVision,
    desktopVisionAvailable: !!e.isElectron && m("desktopVisionButton"),
    screenshotAvailable: !!e.isElectron && m("screenshotButton"),
    tablePetAvailable: m("vrmButton"),
    roleCardAvailable: m("roleCardButton") || K.available,
    roleCardEnabled: K.enabled,
    roleCardName: K.selectedName,
    roleCardSelectedId: K.selectedId,
    roleCardAvatarText: K.selectedAvatarText,
    roleCardAvatarImage: K.selectedAvatarImage,
    roleCardAvatarBackground: K.selectedAvatarBackground,
    roleCards: K.cards,
    isElectron: !!e.isElectron,
    // —— 新增：权限模式 + 上下文进度 + custom 服务商每日积分 ——
    workspace: Uu(e, t),
    permission: Ku(e, t),
    contextWindow: Yu(e, t),
    customCredits: Xu(e, M, t)
  };
}
function Uu(e, t) {
  const n = e?.CLISettings || {}, s = bt(n.cc_path), o = s ? s.split(/[/\\]/).filter(Boolean).slice(-1)[0] || s : "", i = Array.isArray(e?.chatRecentProjects) ? e.chatRecentProjects : [], l = /* @__PURE__ */ new Set(), c = i.map((p) => {
    const m = bt(p?.path || p), k = It(m);
    if (!m || l.has(k)) return null;
    l.add(k);
    const T = m.split(/[/\\]/).filter(Boolean).slice(-1)[0] || m;
    return {
      id: m,
      path: m,
      name: T,
      isActive: It(m) === It(s),
      lastUsed: p?.lastUsed || ""
    };
  }).filter(Boolean);
  s && !c.some((p) => It(p.path) === It(s)) && c.unshift({ id: s, path: s, name: o, isActive: !0, lastUsed: "" });
  const u = e?.gitInfo || e?.workspaceGitInfo || null, g = !!(u && u.enabled !== !1 && (u.branch || u.currentBranch));
  return {
    loaded: !!s,
    path: s,
    name: o || (t ? "未选择工作区" : "No workspace"),
    projects: c,
    git: g ? {
      enabled: !0,
      branch: String(u.branch || u.currentBranch || "main"),
      branches: Array.isArray(u.branches) ? u.branches : [],
      dirty: !!u.dirty,
      ahead: Number(u.ahead || 0),
      behind: Number(u.behind || 0)
    } : { enabled: !1 }
  };
}
function Ku(e, t) {
  const n = Gu(e), s = Qu(e), o = (s.length ? s : [
    { value: "default", label: t ? "默认只读模式" : "Default read-only mode" },
    { value: "plan", label: t ? "计划模式" : "Plan" },
    { value: "acceptEdits", label: t ? "接受编辑模式" : "Accept edit mode" },
    { value: "bypassPermissions", label: t ? "最高权限模式" : "All permissions mode" }
  ]).sort(Wu).map((i) => Pi(i, t));
  return n && !o.some((i) => i.id === n) && o.unshift(Pi({ value: n, label: zu(e, n, t) }, t)), { current: n, options: o };
}
function Wu(e, t) {
  const n = {
    default: 0,
    plan: 1,
    "auto-approve": 2,
    acceptEdits: 2,
    "auto-edit": 2,
    yolo: 3,
    bypassPermissions: 3,
    cowork: 4
  }, s = String(e?.value || e?.id || "").trim(), o = String(t?.value || t?.id || "").trim(), i = Object.prototype.hasOwnProperty.call(n, s) ? n[s] : 99, l = Object.prototype.hasOwnProperty.call(n, o) ? n[o] : 99;
  return i - l;
}
function Qu(e) {
  if (!e || typeof e.getCliPermissionModeOptions != "function") return [];
  try {
    return Ke(e.getCliPermissionModeOptions()).map((t) => ({
      value: String(t?.value || t?.id || "").trim(),
      label: String(t?.label || t?.name || t?.value || t?.id || "").trim()
    })).filter((t) => t.value);
  } catch {
    return [];
  }
}
function zu(e, t, n) {
  try {
    if (e && typeof e.getPermissionModeLabel == "function") {
      const i = e.getPermissionModeLabel(t);
      if (i) return String(i);
    }
  } catch {
  }
  const s = String(t || "default").trim(), o = {
    plan: n ? "计划模式" : "Plan mode",
    default: n ? "默认只读模式" : "Default read-only mode",
    "auto-approve": n ? "接受编辑模式" : "Accept edit mode",
    acceptEdits: n ? "接受编辑模式" : "Accept edit mode",
    "auto-edit": n ? "接受编辑模式" : "Accept edit mode",
    yolo: n ? "最高权限模式" : "All permissions mode",
    bypassPermissions: n ? "最高权限模式" : "All permissions mode",
    cowork: n ? "Cowork模式" : "Cowork mode"
  };
  return o[s] || s || o.default;
}
function Gu(e) {
  try {
    if (e && typeof e.getActiveCliPermissionMode == "function")
      return String(e.getActiveCliPermissionMode() || "default").trim() || "default";
  } catch {
  }
  const t = String(e?.CLISettings?.engine || "local").trim().toLowerCase(), n = {
    ds: e?.dsSettings,
    cc: e?.ccSettings,
    oc: e?.ocSettings,
    qc: e?.qcSettings,
    local: e?.localEnvSettings
  };
  return String(n[t]?.permissionMode || e?.CLISettings?.permissionMode || "default").trim() || "default";
}
function Pi(e, t) {
  const n = String(e?.value || e?.id || "default").trim() || "default", s = n === "acceptEdits" || n === "auto-approve" || n === "auto-edit" ? "accept" : n === "bypassPermissions" || n === "yolo" ? "bypass" : n, o = {
    plan: "fa-solid fa-clipboard-list",
    default: "fa-solid fa-shield-halved",
    accept: "fa-solid fa-pen-to-square",
    bypass: "fa-solid fa-bolt",
    cowork: "fa-solid fa-people-arrows"
  }, i = {
    plan: t ? "只规划不执行，适合先审阅方案" : "Plan only and review before execution",
    default: t ? "执行工具前会保持确认" : "Keep confirmation before tool execution",
    accept: t ? "自动接受编辑类操作，敏感操作仍确认" : "Auto-accept edit operations, keep sensitive prompts",
    bypass: t ? "直接放行工具操作，请确认风险后使用" : "Allow tool operations directly; use with care",
    cowork: t ? "协作模式，适合多人/多智能体流程" : "Collaboration mode for multi-agent workflows"
  };
  return {
    id: n,
    label: String(e?.label || n).trim(),
    icon: o[s] || "fa-solid fa-shield-halved",
    desc: i[s] || (t ? "当前引擎提供的权限模式" : "Permission mode from current engine")
  };
}
function Yu(e, t) {
  const n = e?.settings || {}, s = Number(n.max_input_tokens || n.context_window || n.contextLimit || 1e6), o = Array.isArray(e?.messages) ? e.messages : [];
  let i = 0;
  o.forEach((p) => {
    i += String(p?.pure_content || p?.content || "").length;
  });
  const l = Math.round(i / 1.8), c = s > 0 ? Math.min(1, l / s) : 0, u = c >= 0.85, g = c >= 0.92;
  return {
    used: l,
    limit: s,
    ratio: c,
    percent: Math.round(c * 100),
    warn: u,
    critical: g,
    autoCompactAt: 0.92,
    label: t ? `${yt(l)} / ${yt(s)}` : `${yt(l)} / ${yt(s)}`,
    summary: t ? g ? "即将自动压缩" : u ? "上下文较满，注意压缩" : "上下文充足" : g ? "About to auto-compact" : u ? "Context filling up" : "Plenty of room"
  };
}
function yt(e) {
  return !Number.isFinite(e) || e <= 0 ? "0" : e >= 1e6 ? (e / 1e6).toFixed(2) + "M" : e >= 1e3 ? (e / 1e3).toFixed(1) + "k" : String(e);
}
function Xu(e, t, n) {
  const s = String(t?.vendor || "").toLowerCase();
  if (!(s === "custom" || s === "openxnet" || String(t?.id || "").includes("custom")))
    return { active: !1 };
  const i = e?.subscriptionCredits || {};
  e?.authState?.gatewayUsage;
  const l = Number(i.dailyRemaining || 0), c = Number(i.dailyQuota || 0), u = Number(i.totalRemaining || i.dailyRemaining || 0), g = String(i.activePlanName || i.activePlanCode || "").trim(), p = c > 0 ? Math.min(1, (c - l) / c) : 0;
  return {
    active: !0,
    dailyRemaining: l,
    dailyQuota: c,
    dailyUsedRatio: p,
    totalRemaining: u,
    bonusCredits: Number(i.bonusCredits || 0),
    topupCredits: Number(i.topupCredits || 0),
    planName: g || (n ? "未订阅" : "Free tier"),
    label: n ? `日 ${yt(l)} 剩余` : `Daily ${yt(l)} left`,
    summary: c > 0 ? n ? `今日 ${yt(l)}/${yt(c)} 积分剩余` : `${yt(l)}/${yt(c)} daily credits left` : n ? "尚未配置每日额度" : "No daily quota configured"
  };
}
function Ju(e) {
  const t = Array.isArray(e?.files) ? e.files : [], n = Array.isArray(e?.images) ? e.images : [], s = [];
  return t.forEach((o, i) => {
    o && s.push({
      kind: "file",
      index: i,
      name: String(o.name || ""),
      path: String(o.path || "")
    });
  }), n.forEach((o, i) => {
    o && s.push({
      kind: "image",
      index: i,
      name: String(o.name || ""),
      path: String(o.path || "")
    });
  }), s;
}
function Zu(e) {
  if (!e || typeof e.getPrototypeConversationItems != "function")
    return [];
  let t = [];
  try {
    t = e.getPrototypeConversationItems() || [];
  } catch {
    t = [];
  }
  const n = e.conversationId == null ? null : String(e.conversationId);
  return t.map((s) => {
    const o = s?.id == null ? "" : String(s.id);
    let i = "", l = "";
    try {
      i = e.getPrototypeConversationTitle ? e.getPrototypeConversationTitle(s) : "";
    } catch {
    }
    try {
      l = e.getPrototypeConversationPreview ? e.getPrototypeConversationPreview(s) : "";
    } catch {
    }
    let c = "";
    try {
      c = e.formatDate ? e.formatDate(s?.timestamp) : "";
    } catch {
    }
    return {
      id: o,
      title: String(i || s?.title || "").trim() || (e.t ? e.t("untitled") : "Untitled"),
      preview: Hu(l || ""),
      time: String(c || ""),
      providerName: String(s?.providerName || s?.providerVendor || "").trim(),
      model: String(s?.model || "").trim(),
      isActive: !!o && o === n
    };
  });
}
function ef() {
  const e = Z(), t = Vr(e), n = Nu(e) ? ju(e) : [], s = qu(e, t), o = Zu(e), i = Ju(e), l = qr(e), c = String(s.providerName || l?.name || "").trim(), u = c ? `${c} · ${String(s.model || ms(t)).trim()}` : String(s.model || ms(t)).trim();
  return {
    isZh: t,
    activeMenu: String(e?.activeMenu || ""),
    conversationId: String(e?.conversationId || "").trim(),
    title: Ru(e, t),
    model: s.model,
    modelDisplay: u,
    settings: s,
    messages: n,
    isEmpty: n.length === 0,
    emptyPrompt: Vu(t),
    isSending: !!(e?.isSending || e?.isTyping),
    interpreterEnabled: s.interpreterEnabled,
    asrEnabled: s.asrEnabled,
    canUseHost: !!e,
    conversations: o,
    historyQuery: String(e?.prototypeChatHistoryQuery || ""),
    attachments: i
  };
}
async function tf(e) {
  const t = Z();
  return t ? (t.userInput = String(e || ""), await t.handleSendOrGuidance(), !0) : !1;
}
async function To(e) {
  if (!(!e || typeof e.autoSaveSettings != "function"))
    try {
      await Promise.resolve(e.autoSaveSettings());
    } catch (t) {
      console.warn("[chat-vite] autoSaveSettings failed:", t);
    }
}
function Wr(e, t) {
  const n = bt(t);
  if (!e || !n) return [];
  const s = It(n), o = Array.isArray(e.chatRecentProjects) ? e.chatRecentProjects : [], i = [
    { path: n, lastUsed: (/* @__PURE__ */ new Date()).toISOString() },
    ...o.filter((l) => It(l?.path || l) !== s)
  ].slice(0, 12);
  return e.chatRecentProjects = i, i;
}
function Qr(e, t) {
  const n = bt(t);
  return !e || !n ? !1 : (e.CLISettings || (e.CLISettings = {}), e.CLISettings.enabled = !0, e.CLISettings.cc_path = n, e.CLISettings.visibilityScope || (e.CLISettings.visibilityScope = "workspace"), e.CLISettings.engine || (e.CLISettings.engine = "local"), !0);
}
async function Eo() {
  const e = Z();
  return e ? (typeof e.clearMessages == "function" && await Promise.resolve(e.clearMessages()), e.activeMenu = "chat", !0) : !1;
}
function nf() {
  const e = Z();
  e && (e.showHistoryDialog = !0);
}
function zr() {
  const e = Z();
  if (e) {
    if (typeof e.openModelPicker == "function") {
      e.openModelPicker();
      return;
    }
    e.showModelDialog = !0;
  }
}
async function Gr(e) {
  const t = Z();
  if (!t || !e) return;
  let n = null;
  try {
    typeof t.findModelProviderById == "function" && (n = t.findModelProviderById(e));
  } catch {
    n = null;
  }
  if (n || (n = Ke(t?.modelProviders).find((s) => String(s?.id || "") === String(e || "")) || null), n?.isTemplate) {
    typeof t.selectModelProviderForUiplan == "function" && t.selectModelProviderForUiplan(n), zr();
    return;
  }
  if (typeof t.applyProviderCardToMain == "function") {
    await t.applyProviderCardToMain(n);
    return;
  }
  if (typeof t.selectMainProvider == "function") {
    await t.selectMainProvider(e);
    return;
  }
  n && (t.settings || (t.settings = {}), t.settings.selectedProvider = e, t.settings.model = String(n.modelId || "").trim(), t.settings.base_url = String(n.url || "").trim(), t.settings.api_key = String(n.apiKey || "").trim(), typeof t.autoSaveSettings == "function" && await t.autoSaveSettings());
}
async function sf(e, t) {
  const n = Z();
  if (!n || !e || !t) return;
  let s = null;
  try {
    typeof n.findModelProviderById == "function" && (s = n.findModelProviderById(e));
  } catch {
    s = null;
  }
  if (s || (s = Ke(n?.modelProviders).find((i) => String(i?.id || "") === String(e || "")) || null), !s) return;
  s.modelId = String(t || "").trim();
  const o = Ke(s.models).map((i) => lo(n, i)).filter(Boolean);
  s.models = [s.modelId, ...o.filter((i) => i !== s.modelId)], typeof n.handleProviderDraftChange == "function" && await n.handleProviderDraftChange(s.id), await Gr(s.id);
}
async function of(e) {
  const t = Z();
  if (!t || !e) return;
  let n = null;
  try {
    typeof t.findModelProviderById == "function" && (n = t.findModelProviderById(e));
  } catch {
    n = null;
  }
  n || (n = Ke(t?.modelProviders).find((s) => String(s?.id || "") === String(e || "")) || null), !(!n || typeof t.validateProviderCard != "function") && await t.validateProviderCard(n, { shouldNotify: !0 });
}
async function rf() {
  const e = Z();
  !e || typeof e.browseAllFiles != "function" || await e.browseAllFiles();
}
async function lf() {
  const e = Z();
  !e || typeof e.browseImages != "function" || await e.browseImages();
}
async function af() {
  const e = Z();
  e && (e.codeSettings || (e.codeSettings = { enabled: !1 }), e.codeSettings.enabled = !e.codeSettings.enabled, typeof e.handleInterpreterToggle == "function" ? await e.handleInterpreterToggle(e.codeSettings.enabled) : typeof e.autoSaveSettings == "function" && await e.autoSaveSettings());
}
async function cf() {
  const e = Z();
  if (e) {
    if (typeof e.toggleASR == "function") {
      await e.toggleASR();
      return;
    }
    e.asrSettings && (e.asrSettings.enabled = !e.asrSettings.enabled, typeof e.autoSaveSettings == "function" && await e.autoSaveSettings());
  }
}
async function uf() {
  const e = Z();
  e && (e.memorySettings || (e.memorySettings = { is_memory: !1 }), e.memorySettings.is_memory = !e.memorySettings.is_memory, typeof e.autoSaveSettings == "function" && await e.autoSaveSettings());
}
async function ff(e) {
  const t = Z();
  if (!t) return;
  t.settings || (t.settings = {});
  const n = Number(e);
  t.settings.temperature = Number.isFinite(n) ? Math.max(0, Math.min(2, n)) : 0.7, typeof t.autoSaveSettings == "function" && await t.autoSaveSettings();
}
async function df(e) {
  const t = Z();
  if (!t) return;
  t.settings || (t.settings = {});
  const n = Number(e);
  t.settings.max_tokens = Number.isFinite(n) && n > 0 ? Math.floor(n) : 8192, typeof t.autoSaveSettings == "function" && await t.autoSaveSettings();
}
async function pf(e) {
  const t = Z();
  if (!t) return;
  const n = String(e || "");
  t.system_prompt = n, Array.isArray(t.messages) && t.messages.length > 0 && t.messages[0]?.role === "system" && (t.messages[0].content = n), typeof t.autoSaveSettings == "function" && await t.autoSaveSettings();
}
async function vf() {
  const e = Z();
  if (e) {
    if (e.webSearchSettings || (e.webSearchSettings = { enabled: !1 }), e.webSearchSettings.enabled = !e.webSearchSettings.enabled, typeof e.handleWebSearchToggle == "function") {
      await e.handleWebSearchToggle(e.webSearchSettings.enabled);
      return;
    }
    typeof e.autoSaveSettings == "function" && await e.autoSaveSettings();
  }
}
async function gf() {
  const e = Z();
  if (e) {
    if (e.chromeMCPSettings || (e.chromeMCPSettings = { enabled: !1 }), e.chromeMCPSettings.enabled = !e.chromeMCPSettings.enabled, typeof e.changeChromeMCPEnabled == "function") {
      await e.changeChromeMCPEnabled();
      return;
    }
    typeof e.autoSaveSettings == "function" && await e.autoSaveSettings();
  }
}
async function hf() {
  const e = Z();
  if (e) {
    if (e.ttsSettings || (e.ttsSettings = { enabled: !1 }), e.ttsSettings.enabled = !e.ttsSettings.enabled, typeof e.changeTTSstatus == "function") {
      await e.changeTTSstatus();
      return;
    }
    typeof e.autoSaveSettings == "function" && await e.autoSaveSettings();
  }
}
async function mf() {
  const e = Z();
  e && (e.visionSettings || (e.visionSettings = { desktopVision: !1 }), e.visionSettings.desktopVision = !e.visionSettings.desktopVision, typeof e.autoSaveSettings == "function" && await e.autoSaveSettings());
}
async function yf() {
  const e = Z();
  !e || typeof e.toggleScreenshot != "function" || await e.toggleScreenshot(!1);
}
async function _f() {
  const e = Z();
  !e || typeof e.startVRM != "function" || await e.startVRM();
}
function Yr() {
  const e = Z();
  if (e) {
    if (typeof e.openChatRoleCardPanel == "function") {
      e.openChatRoleCardPanel();
      return;
    }
    e.activeMenu = "role", e.subMenu = "memory", e.activeMemoryTab = "config", typeof e.ensurePrototypeRoleSelection == "function" && e.ensurePrototypeRoleSelection();
  }
}
async function Xr(e) {
  if (e) {
    if (typeof e.changeMemory == "function") {
      await e.changeMemory();
      return;
    }
    typeof e.autoSaveSettings == "function" && await e.autoSaveSettings();
  }
}
async function bf(e) {
  const t = Z();
  if (!t) return !1;
  const n = String(e || "").trim(), s = Ke(t.memories).find((o) => String(o?.id || "") === n);
  return s ? (t.memorySettings || (t.memorySettings = { selectedMemory: null, is_memory: !1 }), t.memorySettings.selectedMemory = s.id, t.memorySettings.is_memory = !0, typeof t.selectRoleMemory == "function" && t.selectRoleMemory(s, { persist: !1 }), await Xr(t), !0) : (Yr(), !1);
}
async function xf() {
  const e = Z();
  return e ? (e.memorySettings || (e.memorySettings = { selectedMemory: null, is_memory: !1 }), e.memorySettings.is_memory = !1, await Xr(e), !0) : !1;
}
async function Sf(e) {
  const t = Z();
  !t || typeof t.loadConversation != "function" || await t.loadConversation(e);
}
async function Cf(e) {
  const t = Z();
  !t || typeof t.confirmDeleteConversation != "function" || await t.confirmDeleteConversation(e);
}
function wf(e) {
  const t = Z();
  t && (t.prototypeChatHistoryQuery = String(e || ""));
}
async function kf() {
  const e = Z();
  if (!e) return !1;
  const t = bt(e.CLISettings?.cc_path);
  let n = "";
  if (typeof e.handlePrototypeProjectEntry == "function") {
    const o = await e.handlePrototypeProjectEntry();
    n = bt(o);
  } else if (typeof e.browseDirectory == "function") {
    const o = await e.browseDirectory();
    n = bt(o);
  }
  const s = bt(e.CLISettings?.cc_path);
  return !n && s && It(s) !== It(t) && (n = s), n ? (Qr(e, n), Wr(e, n), await Eo(), await To(e), !0) : !1;
}
async function Af(e) {
  const t = Z(), n = bt(e?.path || e);
  return !t || !n ? !1 : (Qr(t, n), Wr(t, n), await Eo(), await To(t), !0);
}
function Pf(e) {
  const t = Z();
  if (!(!t || typeof t.handleInputPaste != "function"))
    try {
      t.handleInputPaste(e);
    } catch (n) {
      console.warn("[chat-vite] handleInputPaste failed:", n);
    }
}
function Mf(e) {
  const t = Z();
  if (!(!t || !e || typeof t.removeItem != "function")) {
    if (e.kind === "file")
      t.removeItem(e.index, "file");
    else if (e.kind === "image") {
      const n = Array.isArray(t.files) ? t.files.length : 0;
      t.removeItem(n + e.index, "image");
    }
  }
}
async function Tf(e) {
  const t = Z();
  if (!t) return !1;
  const n = String(e || "default").trim() || "default";
  if (t.CLISettings || (t.CLISettings = {}), t.CLISettings.cc_path && (t.CLISettings.enabled = !0), t.CLISettings.permissionMode = n, typeof t.setActiveCliPermissionMode == "function")
    await Promise.resolve(t.setActiveCliPermissionMode(n));
  else {
    const s = String(t.CLISettings.engine || "local").trim().toLowerCase(), i = {
      ds: "dsSettings",
      cc: "ccSettings",
      oc: "ocSettings",
      qc: "qcSettings",
      local: "localEnvSettings"
    }[s] || "localEnvSettings";
    t[i] || (t[i] = {}), t[i].permissionMode = n;
  }
  return await To(t), !0;
}
async function Ef(e, t) {
  const n = Z();
  if (!n || !e) return !1;
  const s = String(t || "").trim();
  if (!s) return !1;
  if (typeof n.renameConversationById == "function")
    return await n.renameConversationById(e, s), !0;
  if (typeof n.renameConversation == "function")
    return await n.renameConversation(e, s), !0;
  const i = (Array.isArray(n.conversations) ? n.conversations : []).find((l) => String(l?.id || "") === String(e));
  if (i) {
    if (i.title = s, typeof n.persistConversations == "function")
      try {
        await n.persistConversations();
      } catch {
      }
    return !0;
  }
  return !1;
}
async function If(e) {
  const t = Z();
  if (!t || !e) return !1;
  if (typeof t.archiveConversationToMemory == "function")
    return await t.archiveConversationToMemory(e), !0;
  if (typeof t.archiveConversation == "function")
    return await t.archiveConversation(e), !0;
  const s = (Array.isArray(t.conversations) ? t.conversations : []).find((o) => String(o?.id || "") === String(e));
  return s ? (s.archived = !0, s.archivedAt = (/* @__PURE__ */ new Date()).toISOString(), typeof t.showNotification == "function" && t.showNotification("对话已归档为永久记忆", "success"), !0) : !1;
}
async function Rf(e) {
  if (!e) return !1;
  try {
    return await navigator.clipboard.writeText(String(e)), !0;
  } catch {
    return !1;
  }
}
function Lf(e) {
  const t = Z();
  if (!(!t || !e)) {
    if (typeof t.switchGitBranch == "function") {
      t.switchGitBranch(e);
      return;
    }
    t.gitInfo && (t.gitInfo.branch = e, t.gitInfo.currentBranch = e);
  }
}
function Nf() {
  const e = Z();
  e && (typeof e.openUnlockDialog == "function" ? e.openUnlockDialog() : e.showUnlockDialog = !0);
}
async function Of() {
  const e = Z();
  if (!e) return !1;
  const t = [];
  return typeof e.refreshCurrentAccessProfile == "function" && t.push(Promise.resolve(e.refreshCurrentAccessProfile({ silent: !0 })).catch(() => !1)), typeof e.refreshSubscriptionAccountState == "function" && t.push(Promise.resolve(e.refreshSubscriptionAccountState({ silent: !0 })).catch(() => !1)), t.length ? (await Promise.all(t), !0) : !1;
}
function Df() {
  return {
    snapshot: ef,
    sendMessage: tf,
    startNewChat: Eo,
    openHistory: nf,
    openModelPicker: zr,
    selectChatProvider: Gr,
    selectChatProviderModel: sf,
    validateChatProvider: of,
    browseAllFiles: rf,
    browseImages: lf,
    toggleInterpreter: af,
    toggleAsr: cf,
    toggleMemory: uf,
    toggleWebSearch: vf,
    toggleBrowserControl: gf,
    toggleTts: hf,
    toggleDesktopVision: mf,
    triggerScreenshot: yf,
    openTablePet: _f,
    openRoleCardPanel: Yr,
    selectRoleCard: bf,
    disableRoleCard: xf,
    setTemperature: ff,
    setMaxTokens: df,
    setSystemPrompt: pf,
    loadConversation: Sf,
    deleteConversation: Cf,
    setHistoryQuery: wf,
    addProject: kf,
    selectProject: Af,
    handlePaste: Pf,
    removeAttachment: Mf,
    setPermissionMode: Tf,
    openSubscriptionCenter: Nf,
    refreshCredits: Of,
    renameConversation: Ef,
    archiveConversation: If,
    copyConversationId: Rf,
    setGitBranch: Lf
  };
}
const $f = { class: "ox-vite-chat-shell" }, Ff = ["title"], Hf = {
  key: 1,
  class: "oxc-conversations"
}, Bf = { class: "oxc-conversations__header" }, jf = { class: "oxc-conversations__title" }, Vf = { class: "oxc-conversations__header-actions" }, qf = ["title"], Uf = ["title"], Kf = { class: "oxc-conversations__tabs" }, Wf = {
  key: 0,
  class: "oxc-conversations__search"
}, Qf = ["value", "placeholder"], zf = {
  key: 1,
  class: "oxc-conversations__list"
}, Gf = {
  key: 0,
  class: "oxc-conversations__empty"
}, Yf = ["onClick", "onContextmenu"], Xf = { class: "oxc-conversation-item__head" }, Jf = ["title"], Zf = ["title", "onClick"], ed = ["title"], td = {
  key: 1,
  class: "oxc-conversation-item__meta"
}, nd = { key: 0 }, sd = { key: 1 }, od = {
  key: 2,
  class: "oxc-conversation-item__time"
}, id = {
  key: 2,
  class: "oxc-workspace"
}, rd = {
  key: 0,
  class: "oxc-conversations__empty"
}, ld = ["onClick"], ad = { class: "oxc-workspace-project__copy" }, cd = { class: "oxc-workspace-project__body" }, ud = ["onClick", "onContextmenu"], fd = { class: "oxc-conversation-item__head" }, dd = ["title"], pd = ["onClick"], vd = ["title"], gd = { class: "oxc-chat-column" }, hd = { class: "oxc-header" }, md = { class: "oxc-header__left" }, yd = { class: "oxc-header__title" }, _d = ["title"], bd = { class: "oxc-header__right" }, xd = ["title"], Sd = ["title"], Cd = ["title"], wd = {
  key: 0,
  class: "oxc-quest-panel"
}, kd = { class: "oxc-quest-panel__head" }, Ad = { class: "oxc-quest-panel__title" }, Pd = { class: "oxc-quest-panel__body" }, Md = { class: "oxc-quest-card" }, Td = { class: "oxc-quest-url" }, Ed = ["title"], Id = ["title"], Rd = { class: "oxc-quest-grid" }, Ld = { class: "oxc-quest-metric" }, Nd = { class: "oxc-quest-metric" }, Od = { class: "oxc-quest-metric" }, Dd = { class: "oxc-quest-metric" }, $d = { class: "oxc-quest-card" }, Fd = { class: "oxc-quest-hardware-list" }, Hd = { class: "oxc-quest-empty" }, Bd = { class: "oxc-quest-card" }, jd = {
  key: 0,
  class: "oxc-quest-lan-list"
}, Vd = ["onClick"], qd = {
  key: 1,
  class: "oxc-quest-empty"
}, Ud = { class: "oxc-quest-panel__actions" }, Kd = ["disabled"], Wd = ["title"], Qd = { class: "oxc-stream__inner" }, zd = {
  key: 0,
  class: "oxc-project-welcome"
}, Gd = { class: "oxc-project-welcome__inner" }, Yd = { class: "oxc-project-welcome__title" }, Xd = { class: "oxc-project-welcome__path" }, Jd = {
  key: 1,
  class: "oxc-empty"
}, Zd = ["src", "alt"], ep = { key: 1 }, tp = { class: "oxc-msg__content" }, np = { class: "oxc-activity__elapsed" }, sp = { class: "oxc-activity__steps" }, op = { class: "oxc-activity__verb" }, ip = {
  key: 0,
  class: "oxc-activity__title"
}, rp = {
  key: 1,
  class: "oxc-activity__duration"
}, lp = {
  key: 2,
  class: "oxc-activity__detail"
}, ap = {
  key: 1,
  class: "oxc-msg__bubble oxc-msg__bubble--ai oxc-msg__bubble--typing"
}, cp = {
  key: 2,
  class: "oxc-msg__bubble oxc-msg__bubble--ai markdown-body"
}, up = {
  key: 3,
  class: "oxc-msg__bubble oxc-msg__bubble--user"
}, fp = {
  key: 4,
  class: "oxc-msg__time"
}, dp = {
  key: 0,
  class: "oxc-low-credits-banner"
}, pp = { class: "oxc-low-credits-banner__copy" }, vp = ["title"], gp = { class: "oxc-input-card" }, hp = {
  key: 0,
  class: "oxc-attachments"
}, mp = ["src", "alt"], yp = ["title"], _p = ["title", "onClick"], bp = ["value", "placeholder"], xp = { class: "oxc-input-toolbar" }, Sp = { class: "oxc-input-toolbar__left" }, Cp = ["title"], wp = ["title"], kp = ["title"], Ap = {
  key: 0,
  class: "oxc-popover oxc-popover--up oxc-popover--role-card"
}, Pp = { class: "oxc-popover__head" }, Mp = { class: "oxc-popover__option-copy" }, Tp = {
  key: 1,
  class: "oxc-role-card-list"
}, Ep = ["onClick"], Ip = ["src", "alt"], Rp = { key: 1 }, Lp = { class: "oxc-popover__option-copy" }, Np = { class: "oxc-role-card-tag" }, Op = {
  key: 2,
  class: "oxc-role-card-empty"
}, Dp = ["title"], $p = ["title"], Fp = ["title"], Hp = ["title"], Bp = { class: "oxc-popover-wrap" }, jp = ["title"], Vp = { class: "oxc-popover-item__label" }, qp = { class: "oxc-popover-item__label" }, Up = { class: "oxc-popover-item__label" }, Kp = { class: "oxc-popover-item__label" }, Wp = { class: "oxc-popover-item__label" }, Qp = { class: "oxc-input-toolbar__right" }, zp = ["title"], Gp = { class: "oxc-chip__label" }, Yp = { class: "oxc-popover__head" }, Xp = ["onClick"], Jp = { class: "oxc-popover__option-copy" }, Zp = {
  key: 0,
  class: "fa-solid fa-check oxc-popover__option-check"
}, ev = ["title"], tv = { class: "oxc-chip__label" }, nv = { class: "oxc-popover oxc-popover--up oxc-popover--credits" }, sv = { class: "oxc-popover__head" }, ov = ["title", "disabled"], iv = { class: "oxc-credits-grid" }, rv = { class: "oxc-credits-item" }, lv = { class: "oxc-credits-item" }, av = { class: "oxc-credits-item" }, cv = { class: "oxc-credits-item" }, uv = ["title"], fv = {
  viewBox: "0 0 24 24",
  class: "oxc-context-ring__svg"
}, dv = ["stroke-dasharray", "stroke-dashoffset"], pv = { class: "oxc-context-ring__pct" }, vv = { class: "oxc-popover oxc-popover--up oxc-popover--context" }, gv = { class: "oxc-popover__head" }, hv = { class: "oxc-context-bar" }, mv = { class: "oxc-context-note" }, yv = { class: "oxc-context-rows" }, _v = ["title"], bv = { class: "oxc-context-strip oxc-context-strip--below" }, xv = { class: "oxc-context-chip is-provider" }, Sv = { class: "oxc-context-chip is-model" }, Cv = { class: "oxc-context-chip" }, wv = {
  key: 0,
  class: "oxc-context-chip is-feature"
}, kv = {
  key: 1,
  class: "oxc-context-chip is-feature"
}, Av = {
  key: 2,
  class: "oxc-context-chip is-feature"
}, Pv = ["title"], Mv = {
  key: 0,
  class: "oxc-git-dirty"
}, Tv = { class: "oxc-popover oxc-popover--up oxc-popover--git" }, Ev = { class: "oxc-popover__head" }, Iv = { key: 0 }, Rv = ["onClick"], Lv = { class: "oxc-popover__option-copy" }, Nv = {
  key: 0,
  class: "fa-solid fa-check oxc-popover__option-check"
}, Ov = ["title"], Dv = { class: "oxc-settings-panel__header" }, $v = { class: "oxc-settings-panel__title" }, Fv = ["title"], Hv = { class: "oxc-settings-panel__body" }, Bv = { class: "oxc-setting-group" }, jv = { class: "oxc-setting-group__label" }, Vv = { class: "oxc-model-summary" }, qv = { class: "oxc-model-summary__provider" }, Uv = ["src", "alt"], Kv = {
  key: 1,
  class: "oxc-model-summary__fallback"
}, Wv = { class: "oxc-model-summary__copy" }, Qv = { class: "oxc-model-summary__meta-row" }, zv = { class: "oxc-model-summary__model" }, Gv = ["disabled"], Yv = { class: "oxc-model-button__name" }, Xv = {
  key: 0,
  class: "oxc-provider-picker"
}, Jv = { class: "oxc-provider-picker__head" }, Zv = { class: "oxc-provider-grid" }, eg = ["onClick"], tg = { class: "oxc-provider-card__head" }, ng = { class: "oxc-provider-card__brand" }, sg = ["src", "alt"], og = {
  key: 1,
  class: "oxc-provider-card__fallback"
}, ig = { class: "oxc-provider-card__title" }, rg = {
  key: 0,
  class: "oxc-provider-card__active"
}, lg = {
  key: 1,
  class: "oxc-provider-card__template"
}, ag = { class: "oxc-provider-card__model" }, cg = { class: "oxc-provider-card__summary" }, ug = {
  key: 0,
  class: "oxc-provider-card__validation"
}, fg = {
  key: 0,
  class: "oxc-provider-diagnostics"
}, dg = { class: "oxc-provider-picker__head" }, pg = {
  key: 0,
  class: "oxc-provider-diagnostics__message"
}, vg = {
  key: 1,
  class: "oxc-provider-models__chips"
}, gg = ["onClick"], hg = {
  key: 1,
  class: "oxc-provider-models"
}, mg = {
  key: 0,
  class: "oxc-provider-diagnostics"
}, yg = { class: "oxc-provider-picker__head" }, _g = { class: "oxc-provider-diagnostics__chips" }, bg = {
  key: 0,
  class: "oxc-provider-diagnostics__message"
}, xg = {
  key: 1,
  class: "oxc-provider-checks"
}, Sg = {
  key: 2,
  class: "oxc-provider-models__chips"
}, Cg = ["onClick"], wg = { class: "oxc-provider-picker__head" }, kg = { class: "oxc-provider-models__chips" }, Ag = ["onClick"], Pg = { class: "oxc-setting-group__hint" }, Mg = { class: "oxc-setting-group" }, Tg = { class: "oxc-setting-group__label" }, Eg = { class: "oxc-slider-row" }, Ig = ["value"], Rg = { class: "oxc-slider-value" }, Lg = { class: "oxc-setting-group__hint" }, Ng = { class: "oxc-setting-group" }, Og = { class: "oxc-setting-group__label" }, Dg = ["value"], $g = ["value"], Fg = { class: "oxc-setting-group" }, Hg = { class: "oxc-setting-group__label" }, Bg = ["value", "placeholder"], jg = {
  key: 0,
  class: "oxc-setting-group"
}, Vg = { class: "oxc-toggle-row" }, qg = { class: "oxc-setting-group__label" }, Ug = { class: "oxc-toggle" }, Kg = ["checked"], Wg = { class: "oxc-setting-group__hint" }, Qg = { class: "oxc-setting-group" }, zg = { class: "oxc-toggle-row" }, Gg = { class: "oxc-setting-group__label" }, Yg = { class: "oxc-toggle" }, Xg = ["checked"], Jg = { class: "oxc-setting-group__hint" }, Mi = 48, Ti = 168, Zg = 60, eh = 240, th = 680, nh = {
  __name: "App",
  setup(e) {
    const t = Df(), n = /* @__PURE__ */ Se(t.snapshot()), s = /* @__PURE__ */ Se(""), o = /* @__PURE__ */ Se(null), i = /* @__PURE__ */ Se(null), l = /* @__PURE__ */ Se(null), c = /* @__PURE__ */ Se(160), u = /* @__PURE__ */ Se(!1), g = /* @__PURE__ */ Se(!1), p = /* @__PURE__ */ Se(!1), m = /* @__PURE__ */ Se(!1), k = /* @__PURE__ */ Se(!1), T = /* @__PURE__ */ Se(null), $ = /* @__PURE__ */ Se(!0), M = /* @__PURE__ */ Se({
      visible: !1,
      tone: "info",
      text: ""
    });
    let K = null, X = "", z = "", F = null, H = null, se = 0, be = 0;
    const ae = {
      gateway: {
        status: "unknown",
        protocol_version: "vr-gateway/unknown",
        recommended_quest_url: "",
        local_quest_url: "/quest3/"
      },
      network: {
        lan_urls: []
      },
      desktop: {
        connected_device: "unknown"
      },
      device: {
        connected: !1,
        last_seen_at: "",
        age_seconds: null,
        stale_after_seconds: 45,
        session_id: "",
        session_valid: !1,
        name: "",
        model: "",
        device: {},
        capabilities: {},
        hardware: {},
        runtime: {}
      }
    }, Ne = J(() => `${c.value}px`);
    function G() {
      g.value && (g.value = !1), p.value && (p.value = !1), m.value && (m.value = !1), nt.value && (nt.value = !1), ft.value && (ft.value = !1), st.value && (st.value = !1), rn.value && (rn.value = !1), Ue.value.visible && (Ue.value = { visible: !1, x: 0, y: 0, conversationId: "", conversationTitle: "" });
    }
    function ee(f, a = "info") {
      M.value = {
        visible: !0,
        tone: a,
        text: f
      }, F && window.clearTimeout(F), F = window.setTimeout(() => {
        M.value.visible = !1;
      }, 2800);
    }
    function ye(f) {
      return f.map((a) => [
        a.id,
        a.role,
        a.time,
        a.typing ? "typing" : "content",
        a.text || "",
        a.html || "",
        a.activity?.signature || ""
      ].join("::")).join("||");
    }
    function D(f) {
      return (f || []).map((a) => [
        a.id,
        a.title,
        a.preview,
        a.time,
        a.providerName,
        a.model,
        a.isActive ? "1" : "0"
      ].join(":")).join("|");
    }
    function ge(f) {
      if (!f) return "";
      const a = (f.projects || []).map((R) => `${R.id}:${R.isActive ? "1" : "0"}:${R.lastUsed || ""}`).join("|"), d = f.git || {};
      return [
        f.loaded ? "1" : "0",
        f.path || "",
        f.name || "",
        a,
        d.enabled ? "1" : "0",
        d.branch || "",
        d.dirty ? "1" : "0",
        d.ahead || 0,
        d.behind || 0
      ].join("::");
    }
    function Me(f) {
      const a = f || {}, d = a.permission || {}, R = a.contextWindow || {}, he = a.customCredits || {};
      return [
        a.providerId,
        a.providerName,
        a.model,
        a.temperature,
        a.maxTokens,
        a.memoryEnabled ? "1" : "0",
        a.interpreterEnabled ? "1" : "0",
        a.asrEnabled ? "1" : "0",
        a.webSearchEnabled ? "1" : "0",
        a.browserControlEnabled ? "1" : "0",
        a.ttsEnabled ? "1" : "0",
        a.desktopVisionEnabled ? "1" : "0",
        a.roleCardEnabled ? "1" : "0",
        a.roleCardSelectedId,
        a.roleCardAvatarImage,
        a.roleCardAvatarText,
        d.current,
        R.percent,
        he.active ? "1" : "0",
        he.dailyRemaining,
        he.totalRemaining,
        he.planName,
        ge(a.workspace)
      ].join("::");
    }
    function Ze(f, a) {
      return [
        a,
        f.isZh ? "zh" : "en",
        f.activeMenu || "",
        f.conversationId || "",
        f.title || "",
        f.model || "",
        f.modelDisplay || "",
        f.isEmpty ? "1" : "0",
        f.isSending ? "1" : "0",
        f.historyQuery || "",
        D(f.conversations || []),
        Me(f.settings || {}),
        (f.attachments || []).map((d) => `${d.name || ""}:${d.path || ""}`).join("|")
      ].join("||");
    }
    function Ce(f) {
      return typeof window < "u" && typeof window.requestAnimationFrame == "function" ? window.requestAnimationFrame(f) : (f(), 0);
    }
    function ie(f) {
      f && typeof window < "u" && typeof window.cancelAnimationFrame == "function" && window.cancelAnimationFrame(f);
    }
    function ue() {
      return typeof window > "u" ? null : typeof window.morphdom == "function" ? window.morphdom : null;
    }
    function at(f, a) {
      const d = String(a || "");
      d !== f.__oxcStableHtml && (f.__oxcStableHtml = d, f.__oxcStableHtmlFrame && ie(f.__oxcStableHtmlFrame), f.__oxcStableHtmlFrame = Ce(() => {
        if (f.__oxcStableHtmlFrame = 0, d === f.__oxcStableHtmlRendered) return;
        const R = ue();
        if (R && typeof document < "u") {
          const he = document.createElement("div");
          he.innerHTML = d, R(f, he, {
            childrenOnly: !0,
            onBeforeElUpdated(pe, Te) {
              return !(pe.isEqualNode(Te) || pe.matches?.("pre, code, table") && pe.textContent === Te.textContent);
            }
          });
        } else
          f.innerHTML = d;
        f.__oxcStableHtmlRendered = d;
      }));
    }
    const tn = {
      mounted(f, a) {
        f.__oxcStableHtml = "", f.__oxcStableHtmlRendered = "", at(f, a.value);
      },
      updated(f, a) {
        at(f, a.value);
      },
      beforeUnmount(f) {
        f.__oxcStableHtmlFrame && ie(f.__oxcStableHtmlFrame);
      }
    };
    function et() {
      const f = i.value, a = f ? Math.ceil(f.getBoundingClientRect().height) : 132, d = Math.max(132, a + 28);
      return Math.abs(c.value - d) > 1 && (c.value = d), d;
    }
    function Qe() {
      const f = o.value;
      return f ? f.scrollHeight - f.scrollTop - f.clientHeight : 0;
    }
    function Dt() {
      if (!o.value) return !0;
      const f = Math.max(140, Math.min(360, c.value + 72));
      return Qe() <= f;
    }
    function Gn() {
      const f = o.value;
      f && (f.scrollTop = Math.max(0, f.scrollHeight - f.clientHeight + 2));
    }
    function yn(f = !1, a = 2) {
      o.value && (!f && !Dt() || (ie(se), ie(be), se = Ce(() => {
        se = 0, !(!f && !Dt()) && (Gn(), a > 1 && (be = Ce(() => {
          be = 0, (f || Dt()) && Gn();
        })));
      })));
    }
    function ct() {
      const f = Dt();
      Gt(() => {
        Ce(() => {
          et(), (f || n.value.isSending) && yn(!0, n.value.isSending ? 3 : 2);
        });
      });
    }
    function $t(f = n.value) {
      return f?.activeMenu === "chat" && f?.isSending ? Zg : f?.activeMenu === "chat" ? eh : th;
    }
    function nn(f = $t()) {
      K && window.clearTimeout(K), K = window.setTimeout(() => {
        const a = te(!1, { passive: !0 });
        nn($t(a || n.value));
      }, f);
    }
    function te(f = !1, a = {}) {
      const d = !!a?.passive, R = Dt(), he = !!n.value.isSending, pe = t.snapshot(), Te = ye(pe.messages), Cn = Ze(pe, Te), ln = Cn !== X, ns = pe.activeMenu === "chat" && z !== "chat", Vo = pe.activeMenu === "chat" && (pe.isSending || he);
      return (!d || ln || f || ns) && (n.value = pe, X = Cn, Gt(() => {
        et(), yn(f || ns || Vo || R, Vo ? 3 : 2);
      })), z = pe.activeMenu || "", pe;
    }
    function Ft() {
      const f = l.value;
      if (!f) return;
      f.style.height = "auto";
      const a = Math.min(
        Math.max(f.scrollHeight, Mi),
        Ti
      );
      f.style.height = `${a}px`, f.style.overflowY = f.scrollHeight > Ti ? "auto" : "hidden", ct();
    }
    function Io(f) {
      s.value = f.target.value, Gt(Ft);
    }
    function v(f) {
      t.handlePaste(f), Gt(te);
    }
    function h(f) {
      t.removeAttachment(f), te();
    }
    function b() {
      $.value = !$.value;
    }
    async function P() {
      const f = String(s.value || "");
      if (!(!f.trim() && !n.value.isSending)) {
        s.value = "", Gt(() => {
          l.value && (l.value.style.height = `${Mi}px`, l.value.style.overflowY = "hidden");
        });
        try {
          await t.sendMessage(f);
        } catch (a) {
          console.warn("sendMessage failed:", a);
        }
        te(!0);
      }
    }
    function C(f) {
      f.key === "Enter" && !f.shiftKey && (f.preventDefault(), P());
    }
    async function w() {
      await t.startNewChat(), te(!0);
    }
    function L() {
      t.openHistory();
    }
    function I() {
      u.value = !u.value;
    }
    function E() {
      u.value = !1;
    }
    function A() {
      u.value = !0;
    }
    function U(f) {
      const a = f && typeof f == "object" ? f : {}, d = a.status && typeof a.status == "object" ? a.status : a, R = d.gateway && typeof d.gateway == "object" ? d.gateway : {}, he = d.network && typeof d.network == "object" ? d.network : {}, pe = d.desktop && typeof d.desktop == "object" ? d.desktop : {}, Te = d.device && typeof d.device == "object" ? d.device : {}, Cn = d.local && typeof d.local == "object" ? d.local : {}, ln = d.lan && typeof d.lan == "object" ? d.lan : {}, ns = Array.isArray(he.lan_urls) ? he.lan_urls : Array.isArray(ln.interfaces) ? ln.interfaces : [];
      return {
        ...ae,
        ...d,
        gateway: {
          ...ae.gateway,
          ...R,
          status: a.success === !0 || d.success === !0 || ln.available ? "ready" : R.status || ae.gateway.status,
          protocol_version: R.protocol_version || "vr-gateway/v1",
          recommended_quest_url: R.recommended_quest_url || ln.recommended_quest_url || Cn.quest_url || ae.gateway.recommended_quest_url,
          local_quest_url: R.local_quest_url || Cn.quest_url || ae.gateway.local_quest_url
        },
        network: {
          ...ae.network,
          ...he,
          lan_urls: ns
        },
        desktop: {
          ...ae.desktop,
          ...pe
        },
        device: {
          ...ae.device,
          ...Te,
          device: {
            ...ae.device.device,
            ...Te.device && typeof Te.device == "object" ? Te.device : {}
          },
          capabilities: {
            ...ae.device.capabilities,
            ...Te.capabilities && typeof Te.capabilities == "object" ? Te.capabilities : {}
          },
          hardware: {
            ...ae.device.hardware,
            ...Te.hardware && typeof Te.hardware == "object" ? Te.hardware : {}
          },
          runtime: {
            ...ae.device.runtime,
            ...Te.runtime && typeof Te.runtime == "object" ? Te.runtime : {}
          }
        }
      };
    }
    async function N({ silent: f = !1 } = {}) {
      if (k.value) return T.value;
      k.value = !0;
      try {
        const a = await fetch("/v1/vr/status", { headers: { accept: "application/json" } });
        if (!a.ok) throw new Error(`HTTP ${a.status}`);
        T.value = U(await a.json()), f || ee(_.value ? "Quest 3 连接状态已刷新" : "Quest 3 status refreshed", "success");
      } catch (a) {
        console.warn("[chat-vite] refresh Quest status failed:", a), T.value = U({
          gateway: {
            status: "offline",
            recommended_quest_url: "/quest3/",
            local_quest_url: "/quest3/"
          },
          network: {
            lan_urls: []
          }
        }), f || ee(_.value ? "暂时无法读取 Quest Gateway 状态" : "Quest Gateway status unavailable", "warning");
      } finally {
        k.value = !1;
      }
      return T.value;
    }
    function V(f) {
      f && typeof f.stopPropagation == "function" && f.stopPropagation(), m.value = !m.value, m.value && (g.value = !1, p.value = !1, nt.value = !1, ft.value = !1, st.value = !1, N({ silent: !0 }));
    }
    async function W(f) {
      const a = String(f || xn.value || "").trim();
      if (!a) {
        ee(_.value ? "没有可复制的 Quest 地址" : "No Quest URL to copy", "warning");
        return;
      }
      try {
        await navigator.clipboard.writeText(a), ee(_.value ? "Quest 访问地址已复制" : "Quest URL copied", "success");
      } catch (d) {
        console.warn("[chat-vite] copy Quest URL failed:", d), ee(a, "info");
      }
    }
    function ne() {
      const f = xn.value || "/quest3/";
      typeof window < "u" && window.open(f, "_blank", "noopener,noreferrer");
    }
    function ce() {
      t.openModelPicker();
    }
    function fe(f) {
      f && t.selectChatProvider(f.id).then(() => te()).catch((a) => {
        console.error(a);
      });
    }
    function xe(f, a) {
      t.selectChatProviderModel(f, a).then(() => te()).catch((d) => {
        console.error(d);
      });
    }
    function Pe(f) {
      t.validateChatProvider(f).then(() => te()).catch((a) => {
        console.error(a);
      });
    }
    function ze() {
      t.browseAllFiles();
    }
    function Ge() {
      t.browseImages();
    }
    function Ht() {
      t.toggleInterpreter(), te();
    }
    function Yn() {
      t.toggleAsr(), te();
    }
    function Oe() {
      t.toggleMemory(), te();
    }
    const Ie = /* @__PURE__ */ Se("chat");
    async function _n(f) {
      await t.loadConversation(f), te(!0);
    }
    function Xn(f) {
      t.setHistoryQuery(f.target.value), te();
    }
    async function Jr() {
      const f = await t.addProject();
      te(!!f);
    }
    function Zr() {
      t.toggleWebSearch(), te();
    }
    function el() {
      t.toggleBrowserControl(), te();
    }
    function tl() {
      t.toggleTts(), te();
    }
    function nl() {
      t.toggleDesktopVision(), te();
    }
    function sl() {
      t.triggerScreenshot(), g.value = !1;
    }
    function ol() {
      t.openTablePet(), g.value = !1, p.value = !1;
    }
    function il(f) {
      f && typeof f.stopPropagation == "function" && f.stopPropagation(), p.value = !p.value, p.value && (g.value = !1, m.value = !1, nt.value = !1, ft.value = !1, st.value = !1);
    }
    async function rl(f) {
      f?.id && (await t.selectRoleCard(f.id), p.value = !1, te());
    }
    async function ll() {
      await t.disableRoleCard(), p.value = !1, te();
    }
    function al() {
      t.openRoleCardPanel(), p.value = !1;
    }
    function cl(f) {
      f.stopPropagation(), g.value = !g.value, g.value && (p.value = !1, m.value = !1);
    }
    function ul(f) {
      t.setTemperature(f.target.value), te();
    }
    function fl(f) {
      t.setMaxTokens(f.target.value), te();
    }
    function dl(f) {
      t.setSystemPrompt(f.target.value), te();
    }
    const pl = J(() => n.value.messages || []), vl = J(() => n.value.isZh ? "输入消息..." : "Type a message..."), gl = J(() => n.value.isSending && !String(s.value || "").trim() ? "fa-solid fa-stop" : "fa-solid fa-arrow-up"), O = J(() => n.value.settings || {}), Jn = J(() => O.value.providerCards || []), q = J(() => {
      const f = String(O.value.providerId || "").trim();
      return Jn.value.find((a) => String(a?.id || "") === f) || Jn.value[0] || null;
    }), Ro = J(() => O.value.roleCards || []), hl = J(() => {
      const f = String(O.value.roleCardName || "").trim();
      return O.value.roleCardEnabled && f ? _.value ? `当前角色卡：${f}` : `Current role card: ${f}` : _.value ? "角色卡" : "Role card";
    }), sn = J(() => {
      const f = !!O.value.roleCardEnabled, a = String(O.value.roleCardName || "").trim(), d = f ? String(O.value.roleCardAvatarImage || "").trim() : "", R = f ? Array.from(a.replace(/\s+/g, "")).slice(0, 2).join("") : "AI", he = f ? String(O.value.roleCardAvatarText || "").trim() || R || (_.value ? "角" : "R") : "AI", pe = f ? String(O.value.roleCardAvatarBackground || "").trim() : "";
      return {
        image: d,
        text: he,
        alt: f ? a || (_.value ? "角色卡" : "Role card") : "AI",
        roleCard: f,
        style: pe ? { background: pe } : {}
      };
    }), Ae = J(() => O.value.workspace || { loaded: !1, name: "", path: "" }), ut = J(() => O.value.permission || { current: "default", options: [] }), Fe = J(() => O.value.contextWindow || { used: 0, limit: 1e6, ratio: 0, percent: 0, warn: !1, critical: !1, label: "0 / 1M", summary: "" }), tt = J(() => O.value.customCredits || { active: !1 }), nt = /* @__PURE__ */ Se(!1), ft = /* @__PURE__ */ Se(!1), st = /* @__PURE__ */ Se(!1), Zn = /* @__PURE__ */ Se(!1), ml = /* @__PURE__ */ Se(1), Ts = J(() => {
      const f = tt.value;
      if (!f.active) return 1;
      const a = Number(f.dailyQuota || 0), d = Number(f.dailyRemaining || 0);
      return a <= 0 ? 1 : Math.max(0, Math.min(1, d / a));
    }), yl = J(() => !tt.value.active || Zn.value ? !1 : Ts.value <= 0.1), _l = J(() => {
      const f = tt.value, a = Number(f.dailyRemaining || 0), d = Number(f.dailyQuota || 0), R = Math.round(Ts.value * 100);
      return n.value.isZh ? `今日剩余 ${a}/${d} 积分（${R}%），用完前请先充值或切换其它服务商。` : `${a}/${d} daily credits left (${R}%). Top up or switch provider before they run out.`;
    });
    Nn(Ts, (f, a) => {
      f > 0.2 && Zn.value && (Zn.value = !1), ml.value = f;
    });
    function bl() {
      Zn.value = !0;
    }
    function xl(f) {
      f && typeof f.stopPropagation == "function" && f.stopPropagation(), nt.value = !nt.value, nt.value && (ft.value = !1, st.value = !1, p.value = !1, m.value = !1);
    }
    async function Sl(f) {
      nt.value = !1;
      const a = t.setPermissionMode(f);
      te(!0);
      const d = await a;
      te(!!d);
    }
    function Cl(f) {
      const a = (ut.value.options || []).find((d) => d.id === f);
      return a ? a.label : f;
    }
    function wl(f) {
      const a = (ut.value.options || []).find((d) => d.id === f);
      return a ? a.icon : "fa-solid fa-shield-halved";
    }
    function kl(f) {
      f && typeof f.stopPropagation == "function" && f.stopPropagation(), ft.value = !ft.value, ft.value && (nt.value = !1, st.value = !1, p.value = !1, m.value = !1);
    }
    const bn = /* @__PURE__ */ Se(!1);
    async function Lo() {
      if (!bn.value) {
        bn.value = !0;
        try {
          typeof t.refreshCredits == "function" && await t.refreshCredits();
        } finally {
          bn.value = !1, te();
        }
      }
    }
    function Al(f) {
      f && typeof f.stopPropagation == "function" && f.stopPropagation(), st.value = !st.value, st.value && (nt.value = !1, ft.value = !1, p.value = !1, m.value = !1, Lo());
    }
    function No() {
      t.openSubscriptionCenter(), st.value = !1;
    }
    const Oo = J(() => {
      const a = 2 * Math.PI * 9, d = Math.max(0, Math.min(1, Fe.value.ratio || 0));
      return { circumference: a, offset: a * (1 - d) };
    }), on = J(() => U(T.value)), xn = J(() => {
      const f = on.value.gateway || {};
      return String(f.recommended_quest_url || f.local_quest_url || "/quest3/").trim();
    }), Do = J(() => on.value.network?.lan_urls || []), $o = J(() => String(on.value.gateway?.status || "").toLowerCase() === "ready"), Bt = J(() => on.value.device || ae.device), Fo = J(() => Bt.value.connected === !0), Es = J(() => k.value ? "checking" : Fo.value ? "ready" : $o.value ? "checking" : "offline"), Pl = J(() => k.value ? _.value ? "检测中" : "Checking" : Fo.value ? _.value ? "Quest 已连接" : "Quest connected" : $o.value ? _.value ? "等待 Quest 心跳" : "Awaiting Quest" : _.value ? "待启动" : "Pending"), Ml = J(() => {
      const f = String(Bt.value.name || Bt.value.runtime?.device_name || "").trim(), a = String(Bt.value.model || Bt.value.runtime?.device_model || "").trim();
      if (f || a) return [f, a].filter(Boolean).join(" / ");
      const d = String(on.value.desktop?.connected_device || "").trim();
      return !d || d === "unknown" ? _.value ? "Quest 设备待授权" : "Quest device pending" : d;
    }), Tl = J(() => {
      const f = Number(Bt.value.age_seconds);
      return Number.isFinite(f) ? f <= 2 ? _.value ? "刚刚" : "Just now" : f < 60 ? _.value ? `${f} 秒前` : `${f}s ago` : _.value ? `${Math.floor(f / 60)} 分钟前` : `${Math.floor(f / 60)}m ago` : _.value ? "暂无心跳" : "No heartbeat";
    }), El = J(() => {
      const f = Bt.value.runtime || {};
      return String(f.xr_loaded_device || f.xr_loader || f.platform || "Unity XR").trim();
    });
    function Il(f) {
      if (!f || typeof f != "object") return "unknown";
      if (f.available === !0) return "ready";
      const a = String(f.status || "").toLowerCase();
      return a.includes("required") || a.includes("planned") || a.includes("sdk") ? "planned" : a.includes("not_exposed") || a.includes("not_detected") ? "offline" : "unknown";
    }
    function Rl(f) {
      if (!f || typeof f != "object") return _.value ? "未知" : "Unknown";
      const a = String(f.status || "").trim();
      return f.available === !0 ? _.value ? "可用" : "Available" : a === "not_exposed" ? _.value ? "不开放" : "Not exposed" : a === "not_detected" ? _.value ? "未检测" : "Not detected" : a.includes("requires") ? _.value ? "需 SDK/权限" : "SDK/permission" : a.includes("permission_required") ? _.value ? "需授权" : "Permission" : a || (_.value ? "待确认" : "Pending");
    }
    const Ll = J(() => {
      const f = Bt.value.hardware || {};
      return [
        { key: "headset_tracking", icon: "fa-solid fa-location-crosshairs", zh: "头显 6DoF", en: "Headset 6DoF" },
        { key: "controllers", icon: "fa-solid fa-gamepad", zh: "手柄", en: "Controllers" },
        { key: "hand_tracking", icon: "fa-regular fa-hand", zh: "手部追踪", en: "Hand tracking" },
        { key: "passthrough_camera", icon: "fa-solid fa-camera", zh: "透视摄像头", en: "Passthrough" },
        { key: "depth_api", icon: "fa-solid fa-layer-group", zh: "Depth API", en: "Depth API" },
        { key: "scene_mesh", icon: "fa-solid fa-border-all", zh: "房间网格", en: "Scene mesh" },
        { key: "microphone", icon: "fa-solid fa-microphone", zh: "麦克风", en: "Microphone" },
        { key: "raw_lidar_or_radar", icon: "fa-solid fa-ban", zh: "原始雷达/LiDAR", en: "Raw LiDAR/Radar" }
      ].map((a) => {
        const d = f[a.key] || {};
        return {
          ...a,
          capability: d,
          tone: Il(d),
          text: Rl(d)
        };
      });
    }), Sn = /* @__PURE__ */ Se(/* @__PURE__ */ new Set()), rn = /* @__PURE__ */ Se(!1), Ue = /* @__PURE__ */ Se({ visible: !1, x: 0, y: 0, conversationId: "", conversationTitle: "" });
    function Ho(f) {
      return f ? f.isActive ? !0 : Sn.value.has(f.id) : !1;
    }
    async function Nl(f) {
      if (!f) return;
      if (!f.isActive) {
        const d = await t.selectProject(f), R = new Set(Sn.value);
        R.add(f.id), Sn.value = R, te(!!d);
        return;
      }
      const a = new Set(Sn.value);
      a.has(f.id) ? a.delete(f.id) : a.add(f.id), Sn.value = a;
    }
    function Ol(f) {
      return !f || !f.isActive ? [] : Is.value || [];
    }
    function Dl(f) {
      f && typeof f.stopPropagation == "function" && f.stopPropagation(), rn.value = !rn.value;
    }
    function $l(f) {
      t.setGitBranch(f), rn.value = !1, te();
    }
    function es(f, a) {
      if (!a) return;
      f && typeof f.preventDefault == "function" && f.preventDefault(), f && typeof f.stopPropagation == "function" && f.stopPropagation();
      const d = Math.min(f.clientX || 0, window.innerWidth - 220), R = Math.min(f.clientY || 0, window.innerHeight - 200);
      Ue.value = {
        visible: !0,
        x: d,
        y: R,
        conversationId: String(a.id || ""),
        conversationTitle: String(a.title || "")
      };
    }
    function ts() {
      Ue.value.visible && (Ue.value = { visible: !1, x: 0, y: 0, conversationId: "", conversationTitle: "" });
    }
    async function Fl() {
      const f = Ue.value.conversationId, a = Ue.value.conversationTitle || "";
      ts();
      const d = window.prompt("重命名对话", a);
      if (d === null) return;
      const R = String(d || "").trim();
      !R || R === a || (await t.renameConversation(f, R), te(!0));
    }
    async function Hl() {
      const f = Ue.value.conversationId;
      ts();
      const a = await t.copyConversationId(f);
      ee(a ? "对话 ID 已复制" : "复制失败", a ? "success" : "warning");
    }
    async function Bl() {
      const f = Ue.value.conversationId;
      ts(), await t.archiveConversation(f), ee("已归档为永久记忆", "success"), te(!0);
    }
    async function jl() {
      const f = Ue.value.conversationId;
      if (ts(), !f) return;
      const a = String(f);
      try {
        await t.deleteConversation(a);
      } catch (d) {
        console.warn("[chat-vite] deleteConversation bridge failed:", d);
      }
      try {
        const d = window.openxnetApp;
        if (d && Array.isArray(d.conversations)) {
          const R = d.conversations.length;
          d.conversations = d.conversations.filter((pe) => String(pe?.id) !== a), d.conversations.length === R && console.warn(
            "[chat-vite] delete fallback found no match; id sent =",
            a,
            "; ids =",
            d.conversations.map((pe) => `${typeof pe?.id}:${pe?.id}`)
          ), String(d.conversationId) === a && (d.conversationId = null, Array.isArray(d.messages) && (d.messages = [])), typeof d.saveConversations == "function" && d.saveConversations().catch(() => {
          });
        }
      } catch (d) {
        console.warn("[chat-vite] delete fallback failed:", d);
      }
      te(!0);
    }
    const Bo = J(() => {
      if (!q.value) return "";
      const f = String(q.value.validationStatus || "").trim();
      if (!f) return _.value ? "未验证" : "Not validated";
      const a = { success: "验证通过", warning: "需关注", blocked: "阻塞", error: "异常" }, d = { success: "Validated", warning: "Warning", blocked: "Blocked", error: "Error" };
      return _.value ? a[f] || f : d[f] || f;
    }), Is = J(() => n.value.conversations || []), Vl = J(() => n.value.historyQuery || ""), jo = J(() => n.value.attachments || []), ql = J(() => {
      const f = pl.value;
      return f.map((a, d) => {
        const R = f[d - 1], he = a.role === "assistant" && d === f.length - 1 && !!n.value.isSending, pe = !!(R && R.role === a.role);
        return { ...a, sameRole: pe, streaming: he };
      });
    }), _ = J(() => n.value.isZh), Ul = J(() => Number(O.value.temperature || 0).toFixed(1));
    function Rs(f) {
      return String(f?.validationStatus || "").trim() ? Bo.value : _.value ? "未验证" : "Not validated";
    }
    return Nn(
      () => [O.value.providerId, O.value.model],
      (f, a) => {
        const d = `${String(f[0] || "")}::${String(f[1] || "")}`, R = `${String(a[0] || "")}::${String(a[1] || "")}`;
        if (R && d !== R) {
          const he = String(O.value.providerName || "").trim(), pe = String(O.value.model || n.value.model || "").trim();
          ee(
            he ? `${he} · ${pe}` : pe,
            "success"
          );
        }
      }
    ), Co(() => {
      te(!0), nn($t()), Gt(() => {
        Ft(), et(), yn(!0, 3), typeof window < "u" && typeof window.ResizeObserver == "function" && i.value && (H = new window.ResizeObserver(ct), H.observe(i.value));
      }), window.addEventListener("resize", ct), document.addEventListener("mousedown", G);
    }), wo(() => {
      K && (window.clearTimeout(K), K = null), F && (window.clearTimeout(F), F = null), H && (H.disconnect(), H = null), ie(se), ie(be), se = 0, be = 0, window.removeEventListener("resize", ct), document.removeEventListener("mousedown", G);
    }), (f, a) => (x(), S("div", $f, [
      $.value ? B("", !0) : (x(), S("button", {
        key: 0,
        type: "button",
        class: "oxc-conversations-handle",
        title: _.value ? "展开会话栏" : "Expand conversations",
        onClick: b
      }, [...a[24] || (a[24] = [
        r("i", { class: "fa-solid fa-chevron-right" }, null, -1)
      ])], 8, Ff)),
      $.value ? (x(), S("aside", Hf, [
        r("div", Bf, [
          r("span", jf, y(_.value ? "会话" : "Conversations"), 1),
          r("div", Vf, [
            r("button", {
              type: "button",
              class: "oxc-conversations__new",
              title: _.value ? "新对话" : "New chat",
              onClick: w
            }, [...a[25] || (a[25] = [
              r("i", { class: "fa-solid fa-plus" }, null, -1)
            ])], 8, qf),
            r("button", {
              type: "button",
              class: "oxc-conversations__collapse",
              title: _.value ? "收起会话栏" : "Collapse conversations",
              onClick: b
            }, [...a[26] || (a[26] = [
              r("i", { class: "fa-solid fa-chevron-left" }, null, -1)
            ])], 8, Uf)
          ])
        ]),
        r("div", Kf, [
          r("button", {
            type: "button",
            class: j(["oxc-conversations__tab", { "is-active": Ie.value === "chat" }]),
            onClick: a[0] || (a[0] = (d) => Ie.value = "chat")
          }, [
            a[27] || (a[27] = r("i", { class: "fa-solid fa-folder" }, null, -1)),
            r("span", null, y(_.value ? "聊天" : "Chat"), 1)
          ], 2),
          r("button", {
            type: "button",
            class: j(["oxc-conversations__tab", { "is-active": Ie.value === "project" }]),
            onClick: a[1] || (a[1] = (d) => Ie.value = "project")
          }, [
            a[28] || (a[28] = r("i", { class: "fa-solid fa-folder-tree" }, null, -1)),
            r("span", null, y(_.value ? "工作区" : "Workspace"), 1)
          ], 2)
        ]),
        Ie.value === "chat" ? (x(), S("div", Wf, [
          a[29] || (a[29] = r("i", { class: "fa-solid fa-magnifying-glass" }, null, -1)),
          r("input", {
            type: "text",
            value: Vl.value,
            placeholder: _.value ? "搜索..." : "Search...",
            onInput: Xn
          }, null, 40, Qf)
        ])) : B("", !0),
        Ie.value === "chat" ? (x(), S("div", zf, [
          Is.value.length === 0 ? (x(), S("div", Gf, y(_.value ? "暂时还没有会话记录" : "No conversations yet"), 1)) : (x(!0), S(de, { key: 1 }, Re(Is.value, (d) => (x(), S("button", {
            key: d.id,
            type: "button",
            class: j(["oxc-conversation-item", { "is-active": d.isActive }]),
            onClick: (R) => _n(d.id),
            onContextmenu: _e((R) => es(R, d), ["prevent"])
          }, [
            r("div", Xf, [
              r("span", {
                class: "oxc-conversation-item__title",
                title: d.title
              }, y(d.title), 9, Jf),
              r("span", {
                class: "oxc-conversation-item__more",
                title: _.value ? "更多操作" : "More",
                onClick: _e((R) => es(R, d), ["stop"])
              }, [...a[30] || (a[30] = [
                r("i", { class: "fa-solid fa-ellipsis" }, null, -1)
              ])], 8, Zf)
            ]),
            d.preview ? (x(), S("div", {
              key: 0,
              class: "oxc-conversation-item__preview",
              title: d.preview
            }, y(d.preview), 9, ed)) : B("", !0),
            d.providerName || d.model ? (x(), S("div", td, [
              d.providerName ? (x(), S("span", nd, y(d.providerName), 1)) : B("", !0),
              d.model ? (x(), S("span", sd, y(d.model), 1)) : B("", !0)
            ])) : B("", !0),
            d.time ? (x(), S("div", od, y(d.time), 1)) : B("", !0)
          ], 42, Yf))), 128))
        ])) : (x(), S("div", id, [
          r("button", {
            type: "button",
            class: "oxc-workspace__add",
            onClick: Jr
          }, [
            a[31] || (a[31] = r("i", { class: "fa-solid fa-plus" }, null, -1)),
            r("span", null, y(_.value ? "添加项目" : "Add Project"), 1)
          ]),
          Ae.value.projects.length ? B("", !0) : (x(), S("div", rd, y(_.value ? "暂未连接任何项目，点击上方按钮选择文件夹。" : "No projects connected yet. Click above to pick a folder."), 1)),
          (x(!0), S(de, null, Re(Ae.value.projects, (d) => (x(), S("div", {
            key: d.id,
            class: "oxc-workspace-project"
          }, [
            r("button", {
              type: "button",
              class: j(["oxc-workspace-project__head", { "is-active": d.isActive }]),
              onClick: (R) => Nl(d)
            }, [
              a[32] || (a[32] = r("i", { class: "fa-solid fa-folder-tree oxc-workspace-project__icon" }, null, -1)),
              r("div", ad, [
                r("strong", null, y(d.name), 1),
                r("small", null, y(d.path), 1)
              ]),
              r("i", {
                class: j(["fa-solid fa-chevron-down oxc-workspace-project__caret", { "is-open": Ho(d) }])
              }, null, 2)
            ], 10, ld),
            cn(r("div", cd, [
              (x(!0), S(de, null, Re(Ol(d), (R) => (x(), S("button", {
                key: `proj-${d.id}-${R.id}`,
                type: "button",
                class: j(["oxc-conversation-item oxc-conversation-item--nested", { "is-active": R.isActive }]),
                onClick: (he) => _n(R.id),
                onContextmenu: _e((he) => es(he, R), ["prevent"])
              }, [
                r("div", fd, [
                  r("span", {
                    class: "oxc-conversation-item__title",
                    title: R.title
                  }, y(R.title), 9, dd),
                  r("span", {
                    class: "oxc-conversation-item__more",
                    onClick: _e((he) => es(he, R), ["stop"])
                  }, [...a[33] || (a[33] = [
                    r("i", { class: "fa-solid fa-ellipsis" }, null, -1)
                  ])], 8, pd)
                ]),
                R.preview ? (x(), S("div", {
                  key: 0,
                  class: "oxc-conversation-item__preview",
                  title: R.preview
                }, y(R.preview), 9, vd)) : B("", !0)
              ], 42, ud))), 128)),
              d.isActive ? (x(), S("button", {
                key: 0,
                type: "button",
                class: "oxc-workspace-project__new",
                onClick: w
              }, [
                a[34] || (a[34] = r("i", { class: "fa-solid fa-plus" }, null, -1)),
                r("span", null, y(_.value ? "新建项目对话" : "New conversation"), 1)
              ])) : B("", !0)
            ], 512), [
              [Pn, Ho(d)]
            ])
          ]))), 128))
        ]))
      ])) : B("", !0),
      Ue.value.visible ? (x(), S("div", {
        key: 2,
        class: "oxc-conversation-menu",
        style: Pt({ top: Ue.value.y + "px", left: Ue.value.x + "px" }),
        onClick: a[2] || (a[2] = _e(() => {
        }, ["stop"])),
        onMousedown: a[3] || (a[3] = _e(() => {
        }, ["stop"]))
      }, [
        r("button", {
          type: "button",
          class: "oxc-conversation-menu__item",
          onClick: Fl
        }, [
          a[35] || (a[35] = r("i", { class: "fa-solid fa-pen-to-square" }, null, -1)),
          r("span", null, y(_.value ? "重命名对话" : "Rename"), 1)
        ]),
        r("button", {
          type: "button",
          class: "oxc-conversation-menu__item",
          onClick: Hl
        }, [
          a[36] || (a[36] = r("i", { class: "fa-solid fa-copy" }, null, -1)),
          r("span", null, y(_.value ? "复制对话 ID" : "Copy conversation ID"), 1)
        ]),
        r("button", {
          type: "button",
          class: "oxc-conversation-menu__item",
          onClick: Bl
        }, [
          a[37] || (a[37] = r("i", { class: "fa-solid fa-box-archive" }, null, -1)),
          r("span", null, y(_.value ? "归档为永久记忆" : "Archive to memory"), 1)
        ]),
        a[39] || (a[39] = r("div", { class: "oxc-conversation-menu__divider" }, null, -1)),
        r("button", {
          type: "button",
          class: "oxc-conversation-menu__item is-danger",
          onClick: jl
        }, [
          a[38] || (a[38] = r("i", { class: "fa-regular fa-trash-can" }, null, -1)),
          r("span", null, y(_.value ? "删除对话" : "Delete"), 1)
        ])
      ], 36)) : B("", !0),
      r("div", gd, [
        r("header", hd, [
          r("div", md, [
            r("h1", yd, y(n.value.title), 1),
            r("button", {
              type: "button",
              class: "oxc-header__model",
              onClick: A
            }, [
              a[40] || (a[40] = r("i", { class: "fa-solid fa-microchip" }, null, -1)),
              r("span", null, y(n.value.modelDisplay || n.value.model), 1)
            ]),
            r("span", {
              class: "oxc-header__status",
              title: _.value ? "在线" : "Online"
            }, null, 8, _d)
          ]),
          r("div", bd, [
            r("button", {
              type: "button",
              class: "oxc-icon-btn",
              onClick: w,
              title: _.value ? "新对话" : "New chat"
            }, [...a[41] || (a[41] = [
              r("i", { class: "fa-solid fa-plus" }, null, -1)
            ])], 8, xd),
            r("button", {
              type: "button",
              class: "oxc-icon-btn",
              onClick: L,
              title: _.value ? "对话历史" : "History"
            }, [...a[42] || (a[42] = [
              r("i", { class: "fa-solid fa-clock-rotate-left" }, null, -1)
            ])], 8, Sd),
            r("div", {
              class: "oxc-quest-shell",
              onMousedown: a[6] || (a[6] = _e(() => {
              }, ["stop"])),
              onClick: a[7] || (a[7] = _e(() => {
              }, ["stop"]))
            }, [
              r("button", {
                type: "button",
                class: j(["oxc-icon-btn oxc-quest-trigger", { "is-active": m.value, [`is-${Es.value}`]: !0 }]),
                onClick: V,
                title: _.value ? "Meta Quest 3 连接" : "Meta Quest 3 connection"
              }, [
                a[43] || (a[43] = r("i", { class: "fa-solid fa-vr-cardboard" }, null, -1)),
                r("span", {
                  class: j(["oxc-quest-trigger__dot", `is-${Es.value}`])
                }, null, 2)
              ], 10, Cd),
              ke(wt, { name: "oxc-pop" }, {
                default: pt(() => [
                  m.value ? (x(), S("div", wd, [
                    r("div", kd, [
                      r("div", Ad, [
                        a[44] || (a[44] = r("i", { class: "fa-brands fa-meta" }, null, -1)),
                        r("div", null, [
                          r("strong", null, y((_.value, "Meta Quest 3")), 1),
                          r("span", null, y(_.value ? "OpenXnet VR/MR 入口" : "OpenXnet VR/MR entry"), 1)
                        ])
                      ]),
                      r("span", {
                        class: j(["oxc-quest-status", `is-${Es.value}`])
                      }, [
                        a[45] || (a[45] = r("span", null, null, -1)),
                        oo(" " + y(Pl.value), 1)
                      ], 2)
                    ]),
                    r("div", Pd, [
                      r("div", Md, [
                        r("label", null, y(_.value ? "Quest 访问地址" : "Quest URL"), 1),
                        r("div", Td, [
                          r("span", { title: xn.value }, y(xn.value), 9, Ed),
                          r("button", {
                            type: "button",
                            onClick: a[4] || (a[4] = (d) => W(xn.value)),
                            title: _.value ? "复制地址" : "Copy URL"
                          }, [...a[46] || (a[46] = [
                            r("i", { class: "fa-regular fa-copy" }, null, -1)
                          ])], 8, Id)
                        ])
                      ]),
                      r("div", Rd, [
                        r("div", Ld, [
                          r("span", null, y(_.value ? "设备" : "Device"), 1),
                          r("strong", null, y(Ml.value), 1)
                        ]),
                        r("div", Nd, [
                          r("span", null, y(_.value ? "最后心跳" : "Last heartbeat"), 1),
                          r("strong", null, y(Tl.value), 1)
                        ]),
                        r("div", Od, [
                          r("span", null, y(_.value ? "协议" : "Protocol"), 1),
                          r("strong", null, y(on.value.gateway.protocol_version), 1)
                        ]),
                        r("div", Dd, [
                          r("span", null, y(_.value ? "运行时" : "Runtime"), 1),
                          r("strong", null, y(El.value), 1)
                        ])
                      ]),
                      r("div", $d, [
                        r("label", null, y(_.value ? "Quest 3 硬件能力" : "Quest 3 hardware"), 1),
                        r("div", Fd, [
                          (x(!0), S(de, null, Re(Ll.value, (d) => (x(), S("div", {
                            key: d.key,
                            class: j(["oxc-quest-hardware-item", `is-${d.tone}`])
                          }, [
                            r("i", {
                              class: j(d.icon)
                            }, null, 2),
                            r("span", null, y(_.value ? d.zh : d.en), 1),
                            r("strong", null, y(d.text), 1)
                          ], 2))), 128))
                        ]),
                        r("p", Hd, y(_.value ? "Quest 3 不向普通 Unity App 暴露原始雷达/LiDAR 点云；MR 侧使用 Passthrough、Depth API 与 Scene Mesh。" : "Quest 3 does not expose raw LiDAR/Radar point clouds to standard Unity apps; MR uses Passthrough, Depth API, and Scene Mesh."), 1)
                      ]),
                      r("div", Bd, [
                        r("label", null, y(_.value ? "局域网地址" : "LAN URLs"), 1),
                        Do.value.length ? (x(), S("div", jd, [
                          (x(!0), S(de, null, Re(Do.value, (d) => (x(), S("button", {
                            key: d.quest_url,
                            type: "button",
                            class: "oxc-quest-lan-item",
                            onClick: (R) => W(d.quest_url)
                          }, [
                            a[47] || (a[47] = r("i", { class: "fa-solid fa-wifi" }, null, -1)),
                            r("span", null, y(d.quest_url), 1)
                          ], 8, Vd))), 128))
                        ])) : (x(), S("p", qd, y(_.value ? "暂无可用局域网地址，Quest 与电脑需在同一 Wi-Fi。" : "No LAN URL yet. Keep Quest and desktop on the same Wi-Fi."), 1))
                      ])
                    ]),
                    r("div", Ud, [
                      r("button", {
                        type: "button",
                        class: "oxc-quest-action",
                        disabled: k.value,
                        onClick: a[5] || (a[5] = (d) => N())
                      }, [
                        r("i", {
                          class: j(k.value ? "fa-solid fa-spinner fa-spin" : "fa-solid fa-arrows-rotate")
                        }, null, 2),
                        r("span", null, y(_.value ? "刷新" : "Refresh"), 1)
                      ], 8, Kd),
                      r("button", {
                        type: "button",
                        class: "oxc-quest-action",
                        onClick: ne
                      }, [
                        a[48] || (a[48] = r("i", { class: "fa-solid fa-arrow-up-right-from-square" }, null, -1)),
                        r("span", null, y(_.value ? "打开入口" : "Open entry"), 1)
                      ])
                    ])
                  ])) : B("", !0)
                ]),
                _: 1
              })
            ], 32),
            r("button", {
              type: "button",
              class: j(["oxc-icon-btn", { "is-active": u.value }]),
              onClick: I,
              title: _.value ? "对话设置" : "Chat settings"
            }, [...a[49] || (a[49] = [
              r("i", { class: "fa-solid fa-sliders" }, null, -1)
            ])], 10, Wd)
          ])
        ]),
        ke(wt, { name: "oxc-status" }, {
          default: pt(() => [
            M.value.visible ? (x(), S("div", {
              key: 0,
              class: j(["oxc-status-banner", `is-${M.value.tone}`])
            }, [
              r("i", {
                class: j(M.value.tone === "success" ? "fa-solid fa-circle-check" : M.value.tone === "warning" ? "fa-solid fa-triangle-exclamation" : "fa-solid fa-circle-info")
              }, null, 2),
              r("span", null, y(M.value.text), 1)
            ], 2)) : B("", !0)
          ]),
          _: 1
        }),
        r("div", {
          class: "oxc-main",
          style: Pt({ "--oxc-composer-space": Ne.value })
        }, [
          r("div", {
            ref_key: "streamRef",
            ref: o,
            class: "oxc-stream"
          }, [
            r("div", Qd, [
              n.value.isEmpty && Ae.value.loaded ? (x(), S("div", zd, [
                r("div", Gd, [
                  r("h2", Yd, y(_.value ? `我们该在 ${Ae.value.name} 中做什么？` : `What shall we do in ${Ae.value.name}?`), 1),
                  r("p", Xd, y(Ae.value.path), 1)
                ])
              ])) : n.value.isEmpty ? (x(), S("div", Jd, [
                a[50] || (a[50] = r("div", { class: "oxc-empty__icon" }, [
                  r("i", { class: "fa-solid fa-comments" })
                ], -1)),
                r("h2", null, y(_.value ? "开始对话" : "Start a conversation"), 1),
                r("p", null, y(n.value.emptyPrompt), 1)
              ])) : (x(!0), S(de, { key: 2 }, Re(ql.value, (d) => (x(), S("article", {
                key: d.id,
                class: j(["oxc-msg", [
                  `is-${d.role === "assistant" ? "ai" : "user"}`,
                  { "is-same-role": d.sameRole },
                  { "is-typing": d.typing },
                  { "is-streaming": d.streaming }
                ]])
              }, [
                d.role === "assistant" ? (x(), S("div", {
                  key: 0,
                  class: j(["oxc-msg__avatar", { "is-role-card": sn.value.roleCard }]),
                  style: Pt(sn.value.style)
                }, [
                  sn.value.image ? (x(), S("img", {
                    key: 0,
                    src: sn.value.image,
                    alt: sn.value.alt
                  }, null, 8, Zd)) : (x(), S("span", ep, y(sn.value.text), 1))
                ], 6)) : B("", !0),
                r("div", tp, [
                  d.role === "assistant" && d.activity?.visible ? (x(), S("div", {
                    key: 0,
                    class: j(["oxc-activity", { "is-active": d.activity.active }])
                  }, [
                    r("div", np, y(d.activity.elapsedLabel), 1),
                    r("div", sp, [
                      (x(!0), S(de, null, Re(d.activity.steps, (R) => (x(), S("div", {
                        key: R.id,
                        class: j(["oxc-activity__step", [`is-${R.status}`, `is-${R.kind}`]])
                      }, [
                        r("span", op, y(R.label), 1),
                        R.title ? (x(), S("span", ip, y(R.title), 1)) : B("", !0),
                        R.duration ? (x(), S("span", rp, "(" + y(R.duration) + ")", 1)) : B("", !0),
                        R.detail ? (x(), S("span", lp, y(R.detail), 1)) : B("", !0)
                      ], 2))), 128))
                    ])
                  ], 2)) : B("", !0),
                  d.typing && !d.activity?.visible ? (x(), S("div", ap, [...a[51] || (a[51] = [
                    r("div", { class: "oxc-typing-dots" }, [
                      r("span"),
                      r("span"),
                      r("span")
                    ], -1)
                  ])])) : d.role === "assistant" && d.html ? cn((x(), S("div", cp, null, 512)), [
                    [tn, d.html]
                  ]) : d.role !== "assistant" ? (x(), S("div", up, y(d.text), 1)) : B("", !0),
                  d.time && !d.typing ? (x(), S("div", fp, y(d.time), 1)) : B("", !0)
                ])
              ], 2))), 128))
            ])
          ], 512),
          r("div", {
            ref_key: "inputWrapperRef",
            ref: i,
            class: "oxc-input-wrapper"
          }, [
            ke(wt, { name: "oxc-pop" }, {
              default: pt(() => [
                yl.value ? (x(), S("div", dp, [
                  a[54] || (a[54] = r("i", { class: "fa-solid fa-triangle-exclamation" }, null, -1)),
                  r("div", pp, [
                    r("strong", null, y(_.value ? "订阅积分不足" : "Low credits"), 1),
                    r("span", null, y(_l.value), 1)
                  ]),
                  r("button", {
                    type: "button",
                    class: "oxc-low-credits-banner__cta",
                    onClick: No
                  }, [
                    a[52] || (a[52] = r("i", { class: "fa-solid fa-arrow-up-right-from-square" }, null, -1)),
                    r("span", null, y(_.value ? "充值 / 续费" : "Top up"), 1)
                  ]),
                  r("button", {
                    type: "button",
                    class: "oxc-low-credits-banner__close",
                    onClick: bl,
                    title: _.value ? "关闭" : "Dismiss"
                  }, [...a[53] || (a[53] = [
                    r("i", { class: "fa-solid fa-xmark" }, null, -1)
                  ])], 8, vp)
                ])) : B("", !0)
              ]),
              _: 1
            }),
            r("div", gp, [
              jo.value.length ? (x(), S("div", hp, [
                (x(!0), S(de, null, Re(jo.value, (d) => (x(), S("div", {
                  key: d.kind + ":" + d.index + ":" + d.name,
                  class: j(["oxc-attachment", `is-${d.kind}`])
                }, [
                  d.kind === "image" ? (x(), S("img", {
                    key: 0,
                    src: d.path,
                    alt: d.name,
                    class: "oxc-attachment__thumb"
                  }, null, 8, mp)) : (x(), S(de, { key: 1 }, [
                    a[55] || (a[55] = r("span", { class: "oxc-attachment__file-icon" }, [
                      r("i", { class: "fa-regular fa-file" })
                    ], -1)),
                    r("span", {
                      class: "oxc-attachment__file-name",
                      title: d.name
                    }, y(d.name), 9, yp)
                  ], 64)),
                  r("button", {
                    type: "button",
                    class: "oxc-attachment__remove",
                    title: _.value ? "移除" : "Remove",
                    onClick: (R) => h(d)
                  }, [...a[56] || (a[56] = [
                    r("i", { class: "fa-solid fa-xmark" }, null, -1)
                  ])], 8, _p)
                ], 2))), 128))
              ])) : B("", !0),
              r("textarea", {
                ref_key: "textareaRef",
                ref: l,
                value: s.value,
                class: "oxc-input-card__textarea",
                placeholder: vl.value,
                rows: "1",
                onInput: Io,
                onKeydown: C,
                onPaste: v
              }, null, 40, bp),
              r("div", xp, [
                r("div", Sp, [
                  r("button", {
                    type: "button",
                    class: "oxc-toolbar-btn",
                    title: _.value ? "上传文件" : "Attach file",
                    onClick: ze
                  }, [...a[57] || (a[57] = [
                    r("i", { class: "fa-solid fa-paperclip" }, null, -1)
                  ])], 8, Cp),
                  O.value.tablePetAvailable ? (x(), S("button", {
                    key: 0,
                    type: "button",
                    class: "oxc-toolbar-btn",
                    title: _.value ? "桌面宠物" : "Desktop pet",
                    onClick: ol
                  }, [...a[58] || (a[58] = [
                    r("i", { class: "fa-solid fa-user-astronaut" }, null, -1)
                  ])], 8, wp)) : B("", !0),
                  O.value.roleCardAvailable ? (x(), S("div", {
                    key: 1,
                    class: "oxc-popover-wrap oxc-role-card-wrap",
                    onMousedown: a[8] || (a[8] = _e(() => {
                    }, ["stop"])),
                    onClick: a[9] || (a[9] = _e(() => {
                    }, ["stop"]))
                  }, [
                    r("button", {
                      type: "button",
                      class: j(["oxc-toolbar-btn", { "is-active": p.value || O.value.roleCardEnabled }]),
                      title: hl.value,
                      onClick: il
                    }, [...a[59] || (a[59] = [
                      r("i", { class: "fa-solid fa-address-card" }, null, -1)
                    ])], 10, kp),
                    ke(wt, { name: "oxc-pop" }, {
                      default: pt(() => [
                        p.value ? (x(), S("div", Ap, [
                          r("div", Pp, [
                            r("span", null, y(_.value ? "角色卡" : "Role card"), 1),
                            r("small", null, y(O.value.roleCardEnabled ? O.value.roleCardName : _.value ? "未启用" : "Off"), 1)
                          ]),
                          O.value.roleCardEnabled ? (x(), S("button", {
                            key: 0,
                            type: "button",
                            class: "oxc-popover__option",
                            onClick: ll
                          }, [
                            a[60] || (a[60] = r("i", { class: "fa-solid fa-toggle-off" }, null, -1)),
                            r("div", Mp, [
                              r("strong", null, y(_.value ? "停用当前角色卡" : "Disable current role card"), 1),
                              r("small", null, y(_.value ? "本次对话不再注入角色档案" : "Stop injecting role profile into this chat"), 1)
                            ])
                          ])) : B("", !0),
                          Ro.value.length ? (x(), S("div", Tp, [
                            (x(!0), S(de, null, Re(Ro.value, (d) => (x(), S("button", {
                              key: d.id,
                              type: "button",
                              class: j(["oxc-popover__option oxc-role-card-option", { "is-active": d.id === O.value.roleCardSelectedId && O.value.roleCardEnabled }]),
                              onClick: (R) => rl(d)
                            }, [
                              r("span", {
                                class: "oxc-role-card-avatar",
                                style: Pt({ background: d.avatarBackground })
                              }, [
                                d.avatarImage ? (x(), S("img", {
                                  key: 0,
                                  src: d.avatarImage,
                                  alt: d.name
                                }, null, 8, Ip)) : (x(), S("span", Rp, y(d.avatarText || d.initial), 1))
                              ], 4),
                              r("div", Lp, [
                                r("strong", null, y(d.name), 1),
                                r("small", null, y(d.desc), 1)
                              ]),
                              r("span", Np, y(d.tag), 1)
                            ], 10, Ep))), 128))
                          ])) : (x(), S("div", Op, y(_.value ? "还没有可用角色卡" : "No role cards yet"), 1)),
                          r("button", {
                            type: "button",
                            class: "oxc-popover__cta",
                            onClick: al
                          }, [
                            a[61] || (a[61] = r("i", { class: "fa-solid fa-sliders" }, null, -1)),
                            r("span", null, y(_.value ? "角色卡配置" : "Configure role cards"), 1)
                          ])
                        ])) : B("", !0)
                      ]),
                      _: 1
                    })
                  ], 32)) : B("", !0),
                  r("button", {
                    type: "button",
                    class: j(["oxc-toolbar-btn", { "is-active": O.value.webSearchEnabled }]),
                    title: _.value ? "联网搜索" : "Web search",
                    onClick: Zr
                  }, [...a[62] || (a[62] = [
                    r("i", { class: "fa-solid fa-globe" }, null, -1)
                  ])], 10, Dp),
                  r("button", {
                    type: "button",
                    class: j(["oxc-toolbar-btn", { "is-active": n.value.interpreterEnabled }]),
                    title: _.value ? "代码解释器" : "Code interpreter",
                    onClick: Ht
                  }, [...a[63] || (a[63] = [
                    r("i", { class: "fa-solid fa-code" }, null, -1)
                  ])], 10, $p),
                  O.value.memoryAvailable ? (x(), S("button", {
                    key: 2,
                    type: "button",
                    class: j(["oxc-toolbar-btn", { "is-active": O.value.memoryEnabled }]),
                    title: _.value ? "长期记忆" : "Memory",
                    onClick: Oe
                  }, [...a[64] || (a[64] = [
                    r("i", { class: "fa-solid fa-brain" }, null, -1)
                  ])], 10, Fp)) : B("", !0),
                  r("button", {
                    type: "button",
                    class: j(["oxc-toolbar-btn", { "is-active": n.value.asrEnabled }]),
                    title: _.value ? "语音输入" : "Voice input",
                    onClick: Yn
                  }, [...a[65] || (a[65] = [
                    r("i", { class: "fa-solid fa-microphone" }, null, -1)
                  ])], 10, Hp),
                  r("div", Bp, [
                    r("button", {
                      type: "button",
                      class: j(["oxc-toolbar-btn", { "is-active": g.value || O.value.browserControlEnabled || O.value.ttsEnabled || O.value.desktopVisionEnabled }]),
                      title: _.value ? "更多" : "More",
                      onClick: cl
                    }, [...a[66] || (a[66] = [
                      r("i", { class: "fa-solid fa-ellipsis" }, null, -1)
                    ])], 10, jp),
                    ke(wt, { name: "oxc-pop" }, {
                      default: pt(() => [
                        g.value ? (x(), S("div", {
                          key: 0,
                          class: "oxc-popover",
                          onMousedown: a[10] || (a[10] = _e(() => {
                          }, ["stop"])),
                          onClick: a[11] || (a[11] = _e(() => {
                          }, ["stop"]))
                        }, [
                          r("button", {
                            type: "button",
                            class: "oxc-popover-item",
                            onClick: Ge
                          }, [
                            a[67] || (a[67] = r("span", { class: "oxc-popover-item__icon" }, [
                              r("i", { class: "fa-regular fa-image" })
                            ], -1)),
                            r("span", Vp, y(_.value ? "上传图片" : "Upload images"), 1)
                          ]),
                          O.value.browserControlAvailable ? (x(), S("button", {
                            key: 0,
                            type: "button",
                            class: j(["oxc-popover-item", { "is-active": O.value.browserControlEnabled }]),
                            onClick: el
                          }, [
                            a[68] || (a[68] = r("span", { class: "oxc-popover-item__icon" }, [
                              r("i", { class: "fa-solid fa-compass" })
                            ], -1)),
                            r("span", qp, y(_.value ? "浏览器控制" : "Browser control"), 1),
                            r("span", {
                              class: j(["oxc-popover-item__badge", { "is-on": O.value.browserControlEnabled }])
                            }, y(O.value.browserControlEnabled ? _.value ? "已开" : "On" : _.value ? "已关" : "Off"), 3)
                          ], 2)) : B("", !0),
                          O.value.desktopVisionAvailable ? (x(), S("button", {
                            key: 1,
                            type: "button",
                            class: j(["oxc-popover-item", { "is-active": O.value.desktopVisionEnabled }]),
                            onClick: nl
                          }, [
                            a[69] || (a[69] = r("span", { class: "oxc-popover-item__icon" }, [
                              r("i", { class: "fa-solid fa-eye" })
                            ], -1)),
                            r("span", Up, y(_.value ? "桌面视觉" : "Desktop vision"), 1),
                            r("span", {
                              class: j(["oxc-popover-item__badge", { "is-on": O.value.desktopVisionEnabled }])
                            }, y(O.value.desktopVisionEnabled ? _.value ? "已开" : "On" : _.value ? "已关" : "Off"), 3)
                          ], 2)) : B("", !0),
                          O.value.ttsAvailable ? (x(), S("button", {
                            key: 2,
                            type: "button",
                            class: j(["oxc-popover-item", { "is-active": O.value.ttsEnabled }]),
                            onClick: tl
                          }, [
                            a[70] || (a[70] = r("span", { class: "oxc-popover-item__icon" }, [
                              r("i", { class: "fa-solid fa-volume-high" })
                            ], -1)),
                            r("span", Kp, y(_.value ? "语音播报" : "Text-to-speech"), 1),
                            r("span", {
                              class: j(["oxc-popover-item__badge", { "is-on": O.value.ttsEnabled }])
                            }, y(O.value.ttsEnabled ? _.value ? "已开" : "On" : _.value ? "已关" : "Off"), 3)
                          ], 2)) : B("", !0),
                          O.value.screenshotAvailable ? (x(), S("button", {
                            key: 3,
                            type: "button",
                            class: "oxc-popover-item",
                            onClick: sl
                          }, [
                            a[71] || (a[71] = r("span", { class: "oxc-popover-item__icon" }, [
                              r("i", { class: "fa-solid fa-camera" })
                            ], -1)),
                            r("span", Wp, y(_.value ? "截图" : "Screenshot"), 1)
                          ])) : B("", !0)
                        ], 32)) : B("", !0)
                      ]),
                      _: 1
                    })
                  ])
                ]),
                r("div", Qp, [
                  Ae.value.loaded ? (x(), S("div", {
                    key: 0,
                    class: "oxc-chip-shell",
                    onMousedown: a[15] || (a[15] = _e(() => {
                    }, ["stop"])),
                    onClick: a[16] || (a[16] = _e(() => {
                    }, ["stop"]))
                  }, [
                    r("button", {
                      type: "button",
                      class: j(["oxc-chip oxc-chip--permission", {
                        "is-bypass": ["bypassPermissions", "yolo"].includes(ut.value.current),
                        "is-accept": ["acceptEdits", "auto-approve", "auto-edit"].includes(ut.value.current),
                        "is-plan": ut.value.current === "plan"
                      }]),
                      title: _.value ? "权限模式" : "Permission Mode",
                      onClick: xl
                    }, [
                      r("i", {
                        class: j(wl(ut.value.current))
                      }, null, 2),
                      r("span", Gp, y(Cl(ut.value.current)), 1),
                      a[72] || (a[72] = r("i", { class: "fa-solid fa-chevron-down oxc-chip__caret" }, null, -1))
                    ], 10, zp),
                    ke(wt, { name: "oxc-pop" }, {
                      default: pt(() => [
                        cn(r("div", {
                          class: "oxc-popover oxc-popover--up",
                          onMousedown: a[13] || (a[13] = _e(() => {
                          }, ["stop"])),
                          onClick: a[14] || (a[14] = _e(() => {
                          }, ["stop"]))
                        }, [
                          r("div", Yp, y(_.value ? "权限模式" : "Permission Mode"), 1),
                          (x(!0), S(de, null, Re(ut.value.options, (d) => (x(), S("button", {
                            key: d.id,
                            type: "button",
                            class: j(["oxc-popover__option", { "is-active": d.id === ut.value.current }]),
                            onMousedown: a[12] || (a[12] = _e(() => {
                            }, ["stop"])),
                            onClick: _e((R) => Sl(d.id), ["stop"])
                          }, [
                            r("i", {
                              class: j(d.icon)
                            }, null, 2),
                            r("div", Jp, [
                              r("strong", null, y(d.label), 1),
                              r("small", null, y(d.desc), 1)
                            ]),
                            d.id === ut.value.current ? (x(), S("i", Zp)) : B("", !0)
                          ], 42, Xp))), 128))
                        ], 544), [
                          [Pn, nt.value]
                        ])
                      ]),
                      _: 1
                    })
                  ], 32)) : B("", !0),
                  tt.value.active ? (x(), S("div", {
                    key: 1,
                    class: "oxc-chip-shell",
                    onMousedown: a[17] || (a[17] = _e(() => {
                    }, ["stop"])),
                    onClick: a[18] || (a[18] = _e(() => {
                    }, ["stop"]))
                  }, [
                    r("button", {
                      type: "button",
                      class: "oxc-chip oxc-chip--credits",
                      title: tt.value.summary,
                      onClick: Al
                    }, [
                      a[73] || (a[73] = r("i", { class: "fa-solid fa-coins" }, null, -1)),
                      r("span", tv, y(tt.value.label), 1)
                    ], 8, ev),
                    ke(wt, { name: "oxc-pop" }, {
                      default: pt(() => [
                        cn(r("div", nv, [
                          r("div", sv, [
                            r("strong", null, y(_.value ? "订阅积分" : "Subscription Credits"), 1),
                            r("small", null, y(tt.value.planName), 1),
                            r("button", {
                              type: "button",
                              class: j(["oxc-popover__refresh", { "is-spinning": bn.value }]),
                              title: _.value ? "刷新额度" : "Refresh credits",
                              disabled: bn.value,
                              onClick: _e(Lo, ["stop"])
                            }, [...a[74] || (a[74] = [
                              r("i", { class: "fa-solid fa-arrows-rotate" }, null, -1)
                            ])], 10, ov)
                          ]),
                          r("div", iv, [
                            r("div", rv, [
                              r("span", null, y(_.value ? "日剩余" : "Daily Left"), 1),
                              r("strong", null, y(tt.value.dailyRemaining), 1)
                            ]),
                            r("div", lv, [
                              r("span", null, y(_.value ? "日额度" : "Daily Quota"), 1),
                              r("strong", null, y(tt.value.dailyQuota || "—"), 1)
                            ]),
                            r("div", av, [
                              r("span", null, y(_.value ? "赠送" : "Bonus"), 1),
                              r("strong", null, y(tt.value.bonusCredits), 1)
                            ]),
                            r("div", cv, [
                              r("span", null, y(_.value ? "加油包" : "Top-up"), 1),
                              r("strong", null, y(tt.value.topupCredits), 1)
                            ])
                          ]),
                          r("button", {
                            type: "button",
                            class: "oxc-popover__cta",
                            onClick: No
                          }, [
                            a[75] || (a[75] = r("i", { class: "fa-solid fa-arrow-up-right-from-square" }, null, -1)),
                            r("span", null, y(_.value ? "打开订阅中心" : "Open subscription center"), 1)
                          ])
                        ], 512), [
                          [Pn, st.value]
                        ])
                      ]),
                      _: 1
                    })
                  ], 32)) : B("", !0),
                  r("div", {
                    class: "oxc-chip-shell",
                    onMousedown: a[19] || (a[19] = _e(() => {
                    }, ["stop"])),
                    onClick: a[20] || (a[20] = _e(() => {
                    }, ["stop"]))
                  }, [
                    r("button", {
                      type: "button",
                      class: j(["oxc-context-ring", { "is-warn": Fe.value.warn, "is-critical": Fe.value.critical }]),
                      title: `${Fe.value.label} (${Fe.value.percent}%) — ${Fe.value.summary}`,
                      onClick: kl
                    }, [
                      (x(), S("svg", fv, [
                        a[76] || (a[76] = r("circle", {
                          class: "oxc-context-ring__track",
                          cx: "12",
                          cy: "12",
                          r: "9"
                        }, null, -1)),
                        r("circle", {
                          class: "oxc-context-ring__fill",
                          cx: "12",
                          cy: "12",
                          r: "9",
                          "stroke-dasharray": Oo.value.circumference,
                          "stroke-dashoffset": Oo.value.offset,
                          transform: "rotate(-90 12 12)"
                        }, null, 8, dv)
                      ])),
                      r("span", pv, y(Fe.value.percent) + "%", 1)
                    ], 10, uv),
                    ke(wt, { name: "oxc-pop" }, {
                      default: pt(() => [
                        cn(r("div", vv, [
                          r("div", gv, [
                            r("strong", null, y(_.value ? "上下文窗口" : "Context Window"), 1),
                            r("small", null, y(Fe.value.label) + " · " + y(Fe.value.percent) + "%", 1)
                          ]),
                          r("div", hv, [
                            r("div", {
                              class: "oxc-context-bar__fill",
                              style: Pt({ width: Fe.value.percent + "%" })
                            }, null, 4),
                            r("div", {
                              class: "oxc-context-bar__threshold",
                              style: Pt({ left: Fe.value.autoCompactAt * 100 + "%" })
                            }, [
                              r("span", null, y(Math.round(Fe.value.autoCompactAt * 100)) + "%", 1)
                            ], 4)
                          ]),
                          r("p", mv, [
                            a[77] || (a[77] = r("i", { class: "fa-solid fa-circle-info" }, null, -1)),
                            oo(" " + y(_.value ? "OpenXnet 在接近 1M 上下文时会自动压缩历史，无需手动操作。" : "OpenXnet auto-compacts history when context nears 1M — no manual action needed."), 1)
                          ]),
                          r("div", yv, [
                            r("div", null, [
                              r("span", null, y(_.value ? "当前" : "Used"), 1),
                              r("strong", null, y(Fe.value.used), 1)
                            ]),
                            r("div", null, [
                              r("span", null, y(_.value ? "上限" : "Limit"), 1),
                              r("strong", null, y(Fe.value.limit), 1)
                            ]),
                            r("div", null, [
                              r("span", null, y(_.value ? "状态" : "Status"), 1),
                              r("strong", null, y(Fe.value.summary), 1)
                            ])
                          ])
                        ], 512), [
                          [Pn, ft.value]
                        ])
                      ]),
                      _: 1
                    })
                  ], 32),
                  r("button", {
                    type: "button",
                    class: j(["oxc-send-btn", { "is-stopping": n.value.isSending && !String(s.value || "").trim() }]),
                    title: _.value ? "发送" : "Send",
                    onClick: P
                  }, [
                    r("i", {
                      class: j(gl.value)
                    }, null, 2)
                  ], 10, _v)
                ])
              ])
            ]),
            r("div", bv, [
              r("span", xv, [
                a[78] || (a[78] = r("i", { class: "fa-solid fa-plug-circle-check" }, null, -1)),
                r("span", null, y(O.value.providerName || (_.value ? "未选择服务商" : "No provider")), 1)
              ]),
              r("span", Sv, [
                a[79] || (a[79] = r("i", { class: "fa-solid fa-microchip" }, null, -1)),
                r("span", null, y(O.value.model), 1)
              ]),
              r("span", {
                class: j(["oxc-context-chip", q.value && q.value.validationStatus ? `is-${q.value.validationStatus}` : "is-idle"])
              }, [
                a[80] || (a[80] = r("i", { class: "fa-solid fa-shield-halved" }, null, -1)),
                r("span", null, y(Bo.value), 1)
              ], 2),
              r("span", Cv, [
                a[81] || (a[81] = r("i", { class: "fa-solid fa-comments" }, null, -1)),
                r("span", null, y(n.value.conversationId ? _.value ? "记忆已连接" : "Conversation linked" : _.value ? "全新会话" : "Fresh session"), 1)
              ]),
              O.value.memoryEnabled ? (x(), S("span", wv, [
                a[82] || (a[82] = r("i", { class: "fa-solid fa-brain" }, null, -1)),
                r("span", null, y(_.value ? "长期记忆开启" : "Memory enabled"), 1)
              ])) : B("", !0),
              O.value.webSearchEnabled ? (x(), S("span", kv, [
                a[83] || (a[83] = r("i", { class: "fa-solid fa-globe" }, null, -1)),
                r("span", null, y(_.value ? "联网搜索" : "Web search"), 1)
              ])) : B("", !0),
              O.value.interpreterEnabled ? (x(), S("span", Av, [
                a[84] || (a[84] = r("i", { class: "fa-solid fa-code" }, null, -1)),
                r("span", null, y(_.value ? "代码解释器" : "Interpreter"), 1)
              ])) : B("", !0),
              Ae.value.git && Ae.value.git.enabled ? (x(), S("div", {
                key: 3,
                class: "oxc-git-shell",
                onMousedown: a[21] || (a[21] = _e(() => {
                }, ["stop"])),
                onClick: a[22] || (a[22] = _e(() => {
                }, ["stop"]))
              }, [
                r("button", {
                  type: "button",
                  class: "oxc-context-chip is-git",
                  onClick: Dl,
                  title: _.value ? "切换 Git 分支" : "Switch Git branch"
                }, [
                  a[85] || (a[85] = r("i", { class: "fa-solid fa-code-branch" }, null, -1)),
                  r("span", null, y(Ae.value.git.branch), 1),
                  Ae.value.git.dirty ? (x(), S("span", Mv, "●")) : B("", !0),
                  a[86] || (a[86] = r("i", { class: "fa-solid fa-chevron-down oxc-context-chip__caret" }, null, -1))
                ], 8, Pv),
                ke(wt, { name: "oxc-pop" }, {
                  default: pt(() => [
                    cn(r("div", Tv, [
                      r("div", Ev, [
                        r("strong", null, y(_.value ? "Git 分支" : "Git Branches"), 1),
                        Ae.value.git.ahead || Ae.value.git.behind ? (x(), S("small", Iv, " ↑" + y(Ae.value.git.ahead) + " ↓" + y(Ae.value.git.behind), 1)) : B("", !0)
                      ]),
                      (x(!0), S(de, null, Re(Ae.value.git.branches.length ? Ae.value.git.branches : [Ae.value.git.branch], (d) => (x(), S("button", {
                        key: `git-${d}`,
                        type: "button",
                        class: j(["oxc-popover__option", { "is-active": d === Ae.value.git.branch }]),
                        onClick: (R) => $l(d)
                      }, [
                        a[87] || (a[87] = r("i", { class: "fa-solid fa-code-branch" }, null, -1)),
                        r("div", Lv, [
                          r("strong", null, y(d), 1)
                        ]),
                        d === Ae.value.git.branch ? (x(), S("i", Nv)) : B("", !0)
                      ], 10, Rv))), 128))
                    ], 512), [
                      [Pn, rn.value]
                    ])
                  ]),
                  _: 1
                })
              ], 32)) : B("", !0)
            ])
          ], 512)
        ], 4)
      ]),
      r("button", {
        type: "button",
        class: j(["oxc-settings-toggle", { "is-active": u.value }]),
        title: u.value ? _.value ? "收起设置" : "Hide settings" : _.value ? "打开设置" : "Open settings",
        onClick: I
      }, [
        r("i", {
          class: j(u.value ? "fa-solid fa-chevron-right" : "fa-solid fa-chevron-left")
        }, null, 2)
      ], 10, Ov),
      r("aside", {
        class: j(["oxc-settings-panel", { "is-open": u.value }])
      }, [
        r("div", Dv, [
          r("span", $v, y(_.value ? "对话设置" : "Chat settings"), 1),
          r("button", {
            type: "button",
            class: "oxc-settings-panel__close",
            onClick: E,
            title: _.value ? "关闭" : "Close"
          }, [...a[88] || (a[88] = [
            r("i", { class: "fa-solid fa-xmark" }, null, -1)
          ])], 8, Fv)
        ]),
        r("div", Hv, [
          r("div", Bv, [
            r("label", jv, y(_.value ? "模型选择" : "Model"), 1),
            r("div", Vv, [
              r("div", qv, [
                O.value.providerLogo ? (x(), S("img", {
                  key: 0,
                  src: O.value.providerLogo,
                  alt: O.value.providerName,
                  class: "oxc-model-summary__logo"
                }, null, 8, Uv)) : (x(), S("span", Kv, [...a[89] || (a[89] = [
                  r("i", { class: "fa-solid fa-microchip" }, null, -1)
                ])])),
                r("div", Wv, [
                  r("strong", null, y(O.value.providerName), 1),
                  r("span", null, y(O.value.providerSummary || (_.value ? "当前用于实时会话的模型服务商" : "The provider currently used for live chat")), 1)
                ])
              ]),
              r("div", Qv, [
                r("div", zv, y(O.value.model), 1),
                q.value && !q.value.isTemplate ? (x(), S("button", {
                  key: 0,
                  type: "button",
                  class: "oxc-provider-validate-btn",
                  disabled: q.value.isValidating,
                  onClick: a[23] || (a[23] = (d) => Pe(q.value.id))
                }, [
                  r("i", {
                    class: j(q.value.isValidating ? "fa-solid fa-spinner fa-spin" : "fa-solid fa-vial-circle-check")
                  }, null, 2),
                  r("span", null, y(q.value.isValidating ? _.value ? "验证中" : "Validating" : _.value ? "验证" : "Validate"), 1)
                ], 8, Gv)) : B("", !0)
              ])
            ]),
            r("button", {
              type: "button",
              class: "oxc-model-button",
              onClick: ce
            }, [
              r("span", Yv, [
                a[90] || (a[90] = r("i", { class: "fa-solid fa-sliders" }, null, -1)),
                r("span", null, y(_.value ? "打开完整模型配置" : "Open full model config"), 1)
              ]),
              a[91] || (a[91] = r("i", { class: "fa-solid fa-arrow-up-right-from-square oxc-model-button__arrow" }, null, -1))
            ]),
            Jn.value.length ? (x(), S("div", Xv, [
              r("div", Jv, [
                r("span", null, y(_.value ? "可用服务商" : "Available providers"), 1),
                r("small", null, y(O.value.configuredProviderCount) + " " + y(_.value ? "个已配置" : "configured"), 1)
              ]),
              r("div", Zv, [
                (x(!0), S(de, null, Re(Jn.value, (d) => (x(), S("button", {
                  key: d.id,
                  type: "button",
                  class: j(["oxc-provider-card", { "is-active": d.isActive, "is-template": d.isTemplate }]),
                  onClick: (R) => fe(d)
                }, [
                  r("div", tg, [
                    r("div", ng, [
                      d.logo ? (x(), S("img", {
                        key: 0,
                        src: d.logo,
                        alt: d.name,
                        class: "oxc-provider-card__logo"
                      }, null, 8, sg)) : (x(), S("span", og, [...a[92] || (a[92] = [
                        r("i", { class: "fa-solid fa-microchip" }, null, -1)
                      ])])),
                      r("div", ig, [
                        r("strong", null, y(d.name), 1),
                        r("small", null, y(d.validationStatus ? Rs(d) : d.statusLabel), 1)
                      ])
                    ]),
                    d.isActive ? (x(), S("span", rg, y(_.value ? "当前" : "Current"), 1)) : d.isTemplate ? (x(), S("span", lg, y(_.value ? "模板" : "Template"), 1)) : B("", !0)
                  ]),
                  r("div", ag, y(d.modelId || (_.value ? "未设置默认模型" : "No default model")), 1),
                  r("div", cg, y(d.summary || (d.isTemplate ? _.value ? "点击进入配置" : "Open setup" : _.value ? "点击切换到该服务商" : "Switch this provider into the live chat runtime")), 1),
                  d.validationMessage ? (x(), S("div", ug, y(d.validationMessage), 1)) : B("", !0)
                ], 10, eg))), 128))
              ]),
              q.value && !q.value.isTemplate && (q.value.validationStatus || q.value.validationMessage || q.value.validationModels && q.value.validationModels.length) ? (x(), S("div", fg, [
                r("div", dg, [
                  r("span", null, y(_.value ? "当前服务商诊断" : "Current provider diagnostics"), 1),
                  r("small", null, y(Rs(q.value)), 1)
                ]),
                q.value.validationMessage ? (x(), S("div", pg, y(q.value.validationMessage), 1)) : B("", !0),
                q.value.validationModels && q.value.validationModels.length ? (x(), S("div", vg, [
                  (x(!0), S(de, null, Re(q.value.validationModels, (d) => (x(), S("button", {
                    key: `${q.value.id}-validated-${d.value}`,
                    type: "button",
                    class: j(["oxc-provider-model-chip", { "is-active": O.value.model === d.value }]),
                    onClick: (R) => xe(q.value.id, d.value)
                  }, y(d.label), 11, gg))), 128))
                ])) : B("", !0)
              ])) : B("", !0),
              q.value && q.value.models && q.value.models.length ? (x(), S("div", hg, [
                q.value.validationStatus || q.value.validationMessage || q.value.validationChecks && q.value.validationChecks.length || q.value.validationModels && q.value.validationModels.length ? (x(), S("div", mg, [
                  r("div", yg, [
                    r("span", null, y(_.value ? "当前服务商诊断" : "Current provider diagnostics"), 1),
                    r("small", null, y(Rs(q.value)), 1)
                  ]),
                  r("div", _g, [
                    r("span", {
                      class: j(["oxc-provider-diagnostics__chip", { "is-on": q.value.apiKeyConfigured || q.value.apiKeyOptional }])
                    }, [
                      a[93] || (a[93] = r("i", { class: "fa-solid fa-key" }, null, -1)),
                      r("span", null, y(q.value.apiKeyConfigured || q.value.apiKeyOptional ? _.value ? "API Key 已就绪" : "API key ready" : _.value ? "API Key 缺失" : "API key missing"), 1)
                    ], 2),
                    r("span", {
                      class: j(["oxc-provider-diagnostics__chip", { "is-on": q.value.matchedModel }])
                    }, [
                      a[94] || (a[94] = r("i", { class: "fa-solid fa-circle-nodes" }, null, -1)),
                      r("span", null, y(q.value.matchedModel ? _.value ? "模型已匹配" : "Model matched" : _.value ? "模型待确认" : "Model unresolved"), 1)
                    ], 2)
                  ]),
                  q.value.validationMessage ? (x(), S("div", bg, y(q.value.validationMessage), 1)) : B("", !0),
                  q.value.validationChecks && q.value.validationChecks.length ? (x(), S("div", xg, [
                    (x(!0), S(de, null, Re(q.value.validationChecks, (d, R) => (x(), S("div", {
                      key: `${q.value.id}-check-${R}`,
                      class: "oxc-provider-check"
                    }, [
                      r("strong", null, y(d.label || d.name || d.id || (_.value ? "检查项" : "Check")), 1),
                      r("span", null, y(d.message || d.detail || d.status || ""), 1)
                    ]))), 128))
                  ])) : B("", !0),
                  q.value.validationModels && q.value.validationModels.length ? (x(), S("div", Sg, [
                    (x(!0), S(de, null, Re(q.value.validationModels, (d) => (x(), S("button", {
                      key: `${q.value.id}-validated-${d.value}`,
                      type: "button",
                      class: j(["oxc-provider-model-chip", { "is-active": O.value.model === d.value }]),
                      onClick: (R) => xe(q.value.id, d.value)
                    }, y(d.label), 11, Cg))), 128))
                  ])) : B("", !0)
                ])) : B("", !0),
                r("div", wg, [
                  r("span", null, y(_.value ? "当前服务商模型" : "Models in current provider"), 1)
                ]),
                r("div", kg, [
                  (x(!0), S(de, null, Re(q.value.models, (d) => (x(), S("button", {
                    key: `${q.value.id}-${d.value}`,
                    type: "button",
                    class: j(["oxc-provider-model-chip", { "is-active": O.value.model === d.value }]),
                    onClick: (R) => xe(q.value.id, d.value)
                  }, y(d.label), 11, Ag))), 128))
                ])
              ])) : B("", !0)
            ])) : B("", !0),
            r("span", Pg, y(_.value ? "在这里直接切换当前实时会话的服务商和默认模型；需要补 API 地址或 Key 时，再打开完整配置。" : "Switch the active provider and default model here. Open the full model config only when you need to edit endpoints or API keys."), 1)
          ]),
          r("div", Mg, [
            r("label", Tg, y(_.value ? "温度 (Temperature)" : "Temperature"), 1),
            r("div", Eg, [
              r("input", {
                type: "range",
                min: "0",
                max: "2",
                step: "0.1",
                value: O.value.temperature,
                onInput: ul
              }, null, 40, Ig),
              r("span", Rg, y(Ul.value), 1)
            ]),
            r("span", Lg, y(_.value ? "较低更精确，较高更有创意" : "Lower = focused, higher = creative"), 1)
          ]),
          r("div", Ng, [
            r("label", Og, y(_.value ? "最大输出长度" : "Max output tokens"), 1),
            r("select", {
              class: "oxc-select",
              value: O.value.maxTokens,
              onChange: fl
            }, [
              (x(!0), S(de, null, Re(O.value.maxTokensOptions || [], (d) => (x(), S("option", {
                key: d,
                value: d
              }, y(d.toLocaleString()) + " tokens ", 9, $g))), 128))
            ], 40, Dg)
          ]),
          r("div", Fg, [
            r("label", Hg, y(_.value ? "系统提示词" : "System prompt"), 1),
            r("textarea", {
              class: "oxc-textarea",
              value: O.value.systemPrompt,
              placeholder: _.value ? "设定 AI 的角色和行为规则..." : "Define the AI role and behavior rules...",
              onInput: dl
            }, null, 40, Bg)
          ]),
          O.value.memoryAvailable ? (x(), S("div", jg, [
            r("div", Vg, [
              r("label", qg, y(_.value ? "长期记忆" : "Long-term memory"), 1),
              r("label", Ug, [
                r("input", {
                  type: "checkbox",
                  checked: O.value.memoryEnabled,
                  onChange: Oe
                }, null, 40, Kg),
                a[95] || (a[95] = r("span", { class: "oxc-toggle__slider" }, null, -1))
              ])
            ]),
            r("span", Wg, y(_.value ? "开启后 AI 会跨对话沉淀记忆条目" : "When on, the assistant persists memory across chats"), 1)
          ])) : B("", !0),
          r("div", Qg, [
            r("div", zg, [
              r("label", Gg, y(_.value ? "代码解释器" : "Code interpreter"), 1),
              r("label", Yg, [
                r("input", {
                  type: "checkbox",
                  checked: O.value.interpreterEnabled,
                  onChange: Ht
                }, null, 40, Xg),
                a[96] || (a[96] = r("span", { class: "oxc-toggle__slider" }, null, -1))
              ])
            ]),
            r("span", Jg, y(_.value ? "允许 AI 在沙箱中执行代码" : "Lets the assistant execute code in a sandbox"), 1)
          ])
        ])
      ], 2),
      u.value ? (x(), S("div", {
        key: 3,
        class: "oxc-settings-backdrop",
        onClick: E
      })) : B("", !0)
    ]));
  }
};
function ao() {
  const e = document.getElementById("openxnet-vite-chat-root");
  !e || e.dataset.viteMounted === "true" || (_u(nh).mount(e), e.dataset.viteMounted = "true");
}
document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", ao, { once: !0 }) : ao();
window.addEventListener("openxnet-vite-chat-remount", ao);
