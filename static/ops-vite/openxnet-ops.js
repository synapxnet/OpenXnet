// @__NO_SIDE_EFFECTS__
function zs(e) {
  const t = /* @__PURE__ */ Object.create(null);
  for (const s of e.split(",")) t[s] = 1;
  return (s) => s in t;
}
const _e = {}, sn = [], bt = () => {
}, io = () => !1, ns = (e) => e.charCodeAt(0) === 111 && e.charCodeAt(1) === 110 && // uppercase letter
(e.charCodeAt(2) > 122 || e.charCodeAt(2) < 97), ss = (e) => e.startsWith("onUpdate:"), Le = Object.assign, Ys = (e, t) => {
  const s = e.indexOf(t);
  s > -1 && e.splice(s, 1);
}, Yi = Object.prototype.hasOwnProperty, de = (e, t) => Yi.call(e, t), X = Array.isArray, ln = (e) => $n(e) === "[object Map]", dn = (e) => $n(e) === "[object Set]", Cl = (e) => $n(e) === "[object Date]", ee = (e) => typeof e == "function", ke = (e) => typeof e == "string", xt = (e) => typeof e == "symbol", ge = (e) => e !== null && typeof e == "object", ao = (e) => (ge(e) || ee(e)) && ee(e.then) && ee(e.catch), ro = Object.prototype.toString, $n = (e) => ro.call(e), Gi = (e) => $n(e).slice(8, -1), co = (e) => $n(e) === "[object Object]", Gs = (e) => ke(e) && e !== "NaN" && e[0] !== "-" && "" + parseInt(e, 10) === e, bn = /* @__PURE__ */ zs(
  // the leading comma is intentional so empty string "" is also included
  ",key,ref,ref_for,ref_key,onVnodeBeforeMount,onVnodeMounted,onVnodeBeforeUpdate,onVnodeUpdated,onVnodeBeforeUnmount,onVnodeUnmounted"
), ls = (e) => {
  const t = /* @__PURE__ */ Object.create(null);
  return ((s) => t[s] || (t[s] = e(s)));
}, Qi = /-\w/g, ct = ls(
  (e) => e.replace(Qi, (t) => t.slice(1).toUpperCase())
), Xi = /\B([A-Z])/g, Kt = ls(
  (e) => e.replace(Xi, "-$1").toLowerCase()
), uo = ls((e) => e.charAt(0).toUpperCase() + e.slice(1)), ks = ls(
  (e) => e ? `on${uo(e)}` : ""
), yt = (e, t) => !Object.is(e, t), qn = (e, ...t) => {
  for (let s = 0; s < e.length; s++)
    e[s](...t);
}, po = (e, t, s, i = !1) => {
  Object.defineProperty(e, t, {
    configurable: !0,
    enumerable: !1,
    writable: i,
    value: s
  });
}, os = (e) => {
  const t = parseFloat(e);
  return isNaN(t) ? e : t;
};
let Ml;
const is = () => Ml || (Ml = typeof globalThis < "u" ? globalThis : typeof self < "u" ? self : typeof window < "u" ? window : typeof globalThis < "u" ? globalThis : {});
function rt(e) {
  if (X(e)) {
    const t = {};
    for (let s = 0; s < e.length; s++) {
      const i = e[s], a = ke(i) ? ta(i) : rt(i);
      if (a)
        for (const u in a)
          t[u] = a[u];
    }
    return t;
  } else if (ke(e) || ge(e))
    return e;
}
const Ji = /;(?![^(]*\))/g, Zi = /:([^]+)/, ea = /\/\*[^]*?\*\//g;
function ta(e) {
  const t = {};
  return e.replace(ea, "").split(Ji).forEach((s) => {
    if (s) {
      const i = s.split(Zi);
      i.length > 1 && (t[i[0].trim()] = i[1].trim());
    }
  }), t;
}
function $(e) {
  let t = "";
  if (ke(e))
    t = e;
  else if (X(e))
    for (let s = 0; s < e.length; s++) {
      const i = $(e[s]);
      i && (t += i + " ");
    }
  else if (ge(e))
    for (const s in e)
      e[s] && (t += s + " ");
  return t.trim();
}
const na = "itemscope,allowfullscreen,formnovalidate,ismap,nomodule,novalidate,readonly", sa = /* @__PURE__ */ zs(na);
function fo(e) {
  return !!e || e === "";
}
function la(e, t) {
  if (e.length !== t.length) return !1;
  let s = !0;
  for (let i = 0; s && i < e.length; i++)
    s = pn(e[i], t[i]);
  return s;
}
function pn(e, t) {
  if (e === t) return !0;
  let s = Cl(e), i = Cl(t);
  if (s || i)
    return s && i ? e.getTime() === t.getTime() : !1;
  if (s = xt(e), i = xt(t), s || i)
    return e === t;
  if (s = X(e), i = X(t), s || i)
    return s && i ? la(e, t) : !1;
  if (s = ge(e), i = ge(t), s || i) {
    if (!s || !i)
      return !1;
    const a = Object.keys(e).length, u = Object.keys(t).length;
    if (a !== u)
      return !1;
    for (const d in e) {
      const p = e.hasOwnProperty(d), g = t.hasOwnProperty(d);
      if (p && !g || !p && g || !pn(e[d], t[d]))
        return !1;
    }
  }
  return String(e) === String(t);
}
function Qs(e, t) {
  return e.findIndex((s) => pn(s, t));
}
const vo = (e) => !!(e && e.__v_isRef === !0), o = (e) => ke(e) ? e : e == null ? "" : X(e) || ge(e) && (e.toString === ro || !ee(e.toString)) ? vo(e) ? o(e.value) : JSON.stringify(e, go, 2) : String(e), go = (e, t) => vo(t) ? go(e, t.value) : ln(t) ? {
  [`Map(${t.size})`]: [...t.entries()].reduce(
    (s, [i, a], u) => (s[ws(i, u) + " =>"] = a, s),
    {}
  )
} : dn(t) ? {
  [`Set(${t.size})`]: [...t.values()].map((s) => ws(s))
} : xt(t) ? ws(t) : ge(t) && !X(t) && !co(t) ? String(t) : t, ws = (e, t = "") => {
  var s;
  return (
    // Symbol.description in es2019+ so we need to cast here to pass
    // the lib: es2016 check
    xt(e) ? `Symbol(${(s = e.description) != null ? s : t})` : e
  );
};
let Ve;
class oa {
  // TODO isolatedDeclarations "__v_skip"
  constructor(t = !1) {
    this.detached = t, this._active = !0, this._on = 0, this.effects = [], this.cleanups = [], this._isPaused = !1, this._warnOnRun = !0, this.__v_skip = !0, !t && Ve && (Ve.active ? (this.parent = Ve, this.index = (Ve.scopes || (Ve.scopes = [])).push(
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
      const s = Ve;
      try {
        return Ve = this, t();
      } finally {
        Ve = s;
      }
    }
  }
  /**
   * This should only be called on non-detached scopes
   * @internal
   */
  on() {
    ++this._on === 1 && (this.prevScope = Ve, Ve = this);
  }
  /**
   * This should only be called on non-detached scopes
   * @internal
   */
  off() {
    if (this._on > 0 && --this._on === 0) {
      if (Ve === this)
        Ve = this.prevScope;
      else {
        let t = Ve;
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
      let s, i;
      for (s = 0, i = this.effects.length; s < i; s++)
        this.effects[s].stop();
      for (this.effects.length = 0, s = 0, i = this.cleanups.length; s < i; s++)
        this.cleanups[s]();
      if (this.cleanups.length = 0, this.scopes) {
        for (s = 0, i = this.scopes.length; s < i; s++)
          this.scopes[s].stop(!0);
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
function ia() {
  return Ve;
}
let ye;
const Cs = /* @__PURE__ */ new WeakSet();
class mo {
  constructor(t) {
    this.fn = t, this.deps = void 0, this.depsTail = void 0, this.flags = 5, this.next = void 0, this.cleanup = void 0, this.scheduler = void 0, Ve && (Ve.active ? Ve.effects.push(this) : this.flags &= -2);
  }
  pause() {
    this.flags |= 64;
  }
  resume() {
    this.flags & 64 && (this.flags &= -65, Cs.has(this) && (Cs.delete(this), this.trigger()));
  }
  /**
   * @internal
   */
  notify() {
    this.flags & 2 && !(this.flags & 32) || this.flags & 8 || ho(this);
  }
  run() {
    if (!(this.flags & 1))
      return this.fn();
    this.flags |= 2, Rl(this), yo(this);
    const t = ye, s = ut;
    ye = this, ut = !0;
    try {
      return this.fn();
    } finally {
      bo(this), ye = t, ut = s, this.flags &= -3;
    }
  }
  stop() {
    if (this.flags & 1) {
      for (let t = this.deps; t; t = t.nextDep)
        Zs(t);
      this.deps = this.depsTail = void 0, Rl(this), this.onStop && this.onStop(), this.flags &= -2;
    }
  }
  trigger() {
    this.flags & 64 ? Cs.add(this) : this.scheduler ? this.scheduler() : this.runIfDirty();
  }
  /**
   * @internal
   */
  runIfDirty() {
    Vs(this) && this.run();
  }
  get dirty() {
    return Vs(this);
  }
}
let _o = 0, xn, Sn;
function ho(e, t = !1) {
  if (e.flags |= 8, t) {
    e.next = Sn, Sn = e;
    return;
  }
  e.next = xn, xn = e;
}
function Xs() {
  _o++;
}
function Js() {
  if (--_o > 0)
    return;
  if (Sn) {
    let t = Sn;
    for (Sn = void 0; t; ) {
      const s = t.next;
      t.next = void 0, t.flags &= -9, t = s;
    }
  }
  let e;
  for (; xn; ) {
    let t = xn;
    for (xn = void 0; t; ) {
      const s = t.next;
      if (t.next = void 0, t.flags &= -9, t.flags & 1)
        try {
          t.trigger();
        } catch (i) {
          e || (e = i);
        }
      t = s;
    }
  }
  if (e) throw e;
}
function yo(e) {
  for (let t = e.deps; t; t = t.nextDep)
    t.version = -1, t.prevActiveLink = t.dep.activeLink, t.dep.activeLink = t;
}
function bo(e) {
  let t, s = e.depsTail, i = s;
  for (; i; ) {
    const a = i.prevDep;
    i.version === -1 ? (i === s && (s = a), Zs(i), aa(i)) : t = i, i.dep.activeLink = i.prevActiveLink, i.prevActiveLink = void 0, i = a;
  }
  e.deps = t, e.depsTail = s;
}
function Vs(e) {
  for (let t = e.deps; t; t = t.nextDep)
    if (t.dep.version !== t.version || t.dep.computed && (xo(t.dep.computed) || t.dep.version !== t.version))
      return !0;
  return !!e._dirty;
}
function xo(e) {
  if (e.flags & 4 && !(e.flags & 16) || (e.flags &= -17, e.globalVersion === Pn) || (e.globalVersion = Pn, !e.isSSR && e.flags & 128 && (!e.deps && !e._dirty || !Vs(e))))
    return;
  e.flags |= 2;
  const t = e.dep, s = ye, i = ut;
  ye = e, ut = !0;
  try {
    yo(e);
    const a = e.fn(e._value);
    (t.version === 0 || yt(a, e._value)) && (e.flags |= 128, e._value = a, t.version++);
  } catch (a) {
    throw t.version++, a;
  } finally {
    ye = s, ut = i, bo(e), e.flags &= -3;
  }
}
function Zs(e, t = !1) {
  const { dep: s, prevSub: i, nextSub: a } = e;
  if (i && (i.nextSub = a, e.prevSub = void 0), a && (a.prevSub = i, e.nextSub = void 0), s.subs === e && (s.subs = i, !i && s.computed)) {
    s.computed.flags &= -5;
    for (let u = s.computed.deps; u; u = u.nextDep)
      Zs(u, !0);
  }
  !t && !--s.sc && s.map && s.map.delete(s.key);
}
function aa(e) {
  const { prevDep: t, nextDep: s } = e;
  t && (t.nextDep = s, e.prevDep = void 0), s && (s.prevDep = t, e.nextDep = void 0);
}
let ut = !0;
const So = [];
function Dt() {
  So.push(ut), ut = !1;
}
function It() {
  const e = So.pop();
  ut = e === void 0 ? !0 : e;
}
function Rl(e) {
  const { cleanup: t } = e;
  if (e.cleanup = void 0, t) {
    const s = ye;
    ye = void 0;
    try {
      t();
    } finally {
      ye = s;
    }
  }
}
let Pn = 0;
class ra {
  constructor(t, s) {
    this.sub = t, this.dep = s, this.version = s.version, this.nextDep = this.prevDep = this.nextSub = this.prevSub = this.prevActiveLink = void 0;
  }
}
class el {
  // TODO isolatedDeclarations "__v_skip"
  constructor(t) {
    this.computed = t, this.version = 0, this.activeLink = void 0, this.subs = void 0, this.map = void 0, this.key = void 0, this.sc = 0, this.__v_skip = !0;
  }
  track(t) {
    if (!ye || !ut || ye === this.computed)
      return;
    let s = this.activeLink;
    if (s === void 0 || s.sub !== ye)
      s = this.activeLink = new ra(ye, this), ye.deps ? (s.prevDep = ye.depsTail, ye.depsTail.nextDep = s, ye.depsTail = s) : ye.deps = ye.depsTail = s, ko(s);
    else if (s.version === -1 && (s.version = this.version, s.nextDep)) {
      const i = s.nextDep;
      i.prevDep = s.prevDep, s.prevDep && (s.prevDep.nextDep = i), s.prevDep = ye.depsTail, s.nextDep = void 0, ye.depsTail.nextDep = s, ye.depsTail = s, ye.deps === s && (ye.deps = i);
    }
    return s;
  }
  trigger(t) {
    this.version++, Pn++, this.notify(t);
  }
  notify(t) {
    Xs();
    try {
      for (let s = this.subs; s; s = s.prevSub)
        s.sub.notify() && s.sub.dep.notify();
    } finally {
      Js();
    }
  }
}
function ko(e) {
  if (e.dep.sc++, e.sub.flags & 4) {
    const t = e.dep.computed;
    if (t && !e.dep.subs) {
      t.flags |= 20;
      for (let i = t.deps; i; i = i.nextDep)
        ko(i);
    }
    const s = e.dep.subs;
    s !== e && (e.prevSub = s, s && (s.nextSub = e)), e.dep.subs = e;
  }
}
const Os = /* @__PURE__ */ new WeakMap(), Xt = /* @__PURE__ */ Symbol(
  ""
), $s = /* @__PURE__ */ Symbol(
  ""
), An = /* @__PURE__ */ Symbol(
  ""
);
function Fe(e, t, s) {
  if (ut && ye) {
    let i = Os.get(e);
    i || Os.set(e, i = /* @__PURE__ */ new Map());
    let a = i.get(s);
    a || (i.set(s, a = new el()), a.map = i, a.key = s), a.track();
  }
}
function Tt(e, t, s, i, a, u) {
  const d = Os.get(e);
  if (!d) {
    Pn++;
    return;
  }
  const p = (g) => {
    g && g.trigger();
  };
  if (Xs(), t === "clear")
    d.forEach(p);
  else {
    const g = X(e), S = g && Gs(s);
    if (g && s === "length") {
      const b = Number(i);
      d.forEach((w, V) => {
        (V === "length" || V === An || !xt(V) && V >= b) && p(w);
      });
    } else
      switch ((s !== void 0 || d.has(void 0)) && p(d.get(s)), S && p(d.get(An)), t) {
        case "add":
          g ? S && p(d.get("length")) : (p(d.get(Xt)), ln(e) && p(d.get($s)));
          break;
        case "delete":
          g || (p(d.get(Xt)), ln(e) && p(d.get($s)));
          break;
        case "set":
          ln(e) && p(d.get(Xt));
          break;
      }
  }
  Js();
}
function tn(e) {
  const t = /* @__PURE__ */ ue(e);
  return t === e ? t : (Fe(t, "iterate", An), /* @__PURE__ */ nt(e) ? t : t.map(dt));
}
function as(e) {
  return Fe(e = /* @__PURE__ */ ue(e), "iterate", An), e;
}
function _t(e, t) {
  return /* @__PURE__ */ Vt(e) ? rn(/* @__PURE__ */ Jt(e) ? dt(t) : t) : dt(t);
}
const ca = {
  __proto__: null,
  [Symbol.iterator]() {
    return Ms(this, Symbol.iterator, (e) => _t(this, e));
  },
  concat(...e) {
    return tn(this).concat(
      ...e.map((t) => X(t) ? tn(t) : t)
    );
  },
  entries() {
    return Ms(this, "entries", (e) => (e[1] = _t(this, e[1]), e));
  },
  every(e, t) {
    return wt(this, "every", e, t, void 0, arguments);
  },
  filter(e, t) {
    return wt(
      this,
      "filter",
      e,
      t,
      (s) => s.map((i) => _t(this, i)),
      arguments
    );
  },
  find(e, t) {
    return wt(
      this,
      "find",
      e,
      t,
      (s) => _t(this, s),
      arguments
    );
  },
  findIndex(e, t) {
    return wt(this, "findIndex", e, t, void 0, arguments);
  },
  findLast(e, t) {
    return wt(
      this,
      "findLast",
      e,
      t,
      (s) => _t(this, s),
      arguments
    );
  },
  findLastIndex(e, t) {
    return wt(this, "findLastIndex", e, t, void 0, arguments);
  },
  // flat, flatMap could benefit from ARRAY_ITERATE but are not straight-forward to implement
  forEach(e, t) {
    return wt(this, "forEach", e, t, void 0, arguments);
  },
  includes(...e) {
    return Rs(this, "includes", e);
  },
  indexOf(...e) {
    return Rs(this, "indexOf", e);
  },
  join(e) {
    return tn(this).join(e);
  },
  // keys() iterator only reads `length`, no optimization required
  lastIndexOf(...e) {
    return Rs(this, "lastIndexOf", e);
  },
  map(e, t) {
    return wt(this, "map", e, t, void 0, arguments);
  },
  pop() {
    return mn(this, "pop");
  },
  push(...e) {
    return mn(this, "push", e);
  },
  reduce(e, ...t) {
    return Tl(this, "reduce", e, t);
  },
  reduceRight(e, ...t) {
    return Tl(this, "reduceRight", e, t);
  },
  shift() {
    return mn(this, "shift");
  },
  // slice could use ARRAY_ITERATE but also seems to beg for range tracking
  some(e, t) {
    return wt(this, "some", e, t, void 0, arguments);
  },
  splice(...e) {
    return mn(this, "splice", e);
  },
  toReversed() {
    return tn(this).toReversed();
  },
  toSorted(e) {
    return tn(this).toSorted(e);
  },
  toSpliced(...e) {
    return tn(this).toSpliced(...e);
  },
  unshift(...e) {
    return mn(this, "unshift", e);
  },
  values() {
    return Ms(this, "values", (e) => _t(this, e));
  }
};
function Ms(e, t, s) {
  const i = as(e), a = i[t]();
  return i !== e && !/* @__PURE__ */ nt(e) && (a._next = a.next, a.next = () => {
    const u = a._next();
    return u.done || (u.value = s(u.value)), u;
  }), a;
}
const ua = Array.prototype;
function wt(e, t, s, i, a, u) {
  const d = as(e), p = d !== e && !/* @__PURE__ */ nt(e), g = d[t];
  if (g !== ua[t]) {
    const w = g.apply(e, u);
    return p ? dt(w) : w;
  }
  let S = s;
  d !== e && (p ? S = function(w, V) {
    return s.call(this, _t(e, w), V, e);
  } : s.length > 2 && (S = function(w, V) {
    return s.call(this, w, V, e);
  }));
  const b = g.call(d, S, i);
  return p && a ? a(b) : b;
}
function Tl(e, t, s, i) {
  const a = as(e), u = a !== e && !/* @__PURE__ */ nt(e);
  let d = s, p = !1;
  a !== e && (u ? (p = i.length === 0, d = function(S, b, w) {
    return p && (p = !1, S = _t(e, S)), s.call(this, S, _t(e, b), w, e);
  }) : s.length > 3 && (d = function(S, b, w) {
    return s.call(this, S, b, w, e);
  }));
  const g = a[t](d, ...i);
  return p ? _t(e, g) : g;
}
function Rs(e, t, s) {
  const i = /* @__PURE__ */ ue(e);
  Fe(i, "iterate", An);
  const a = i[t](...s);
  return (a === -1 || a === !1) && /* @__PURE__ */ ll(s[0]) ? (s[0] = /* @__PURE__ */ ue(s[0]), i[t](...s)) : a;
}
function mn(e, t, s = []) {
  Dt(), Xs();
  const i = (/* @__PURE__ */ ue(e))[t].apply(e, s);
  return Js(), It(), i;
}
const da = /* @__PURE__ */ zs("__proto__,__v_isRef,__isVue"), wo = new Set(
  /* @__PURE__ */ Object.getOwnPropertyNames(Symbol).filter((e) => e !== "arguments" && e !== "caller").map((e) => Symbol[e]).filter(xt)
);
function pa(e) {
  xt(e) || (e = String(e));
  const t = /* @__PURE__ */ ue(this);
  return Fe(t, "has", e), t.hasOwnProperty(e);
}
class Co {
  constructor(t = !1, s = !1) {
    this._isReadonly = t, this._isShallow = s;
  }
  get(t, s, i) {
    if (s === "__v_skip") return t.__v_skip;
    const a = this._isReadonly, u = this._isShallow;
    if (s === "__v_isReactive")
      return !a;
    if (s === "__v_isReadonly")
      return a;
    if (s === "__v_isShallow")
      return u;
    if (s === "__v_raw")
      return i === (a ? u ? Sa : Eo : u ? To : Ro).get(t) || // receiver is not the reactive proxy, but has the same prototype
      // this means the receiver is a user proxy of the reactive proxy
      Object.getPrototypeOf(t) === Object.getPrototypeOf(i) ? t : void 0;
    const d = X(t);
    if (!a) {
      let g;
      if (d && (g = ca[s]))
        return g;
      if (s === "hasOwnProperty")
        return pa;
    }
    const p = Reflect.get(
      t,
      s,
      // if this is a proxy wrapping a ref, return methods using the raw ref
      // as receiver so that we don't have to call `toRaw` on the ref in all
      // its class methods
      /* @__PURE__ */ Ne(t) ? t : i
    );
    if ((xt(s) ? wo.has(s) : da(s)) || (a || Fe(t, "get", s), u))
      return p;
    if (/* @__PURE__ */ Ne(p)) {
      const g = d && Gs(s) ? p : p.value;
      return a && ge(g) ? /* @__PURE__ */ Ns(g) : g;
    }
    return ge(p) ? a ? /* @__PURE__ */ Ns(p) : /* @__PURE__ */ nl(p) : p;
  }
}
class Mo extends Co {
  constructor(t = !1) {
    super(!1, t);
  }
  set(t, s, i, a) {
    let u = t[s];
    const d = X(t) && Gs(s);
    if (!this._isShallow) {
      const S = /* @__PURE__ */ Vt(u);
      if (!/* @__PURE__ */ nt(i) && !/* @__PURE__ */ Vt(i) && (u = /* @__PURE__ */ ue(u), i = /* @__PURE__ */ ue(i)), !d && /* @__PURE__ */ Ne(u) && !/* @__PURE__ */ Ne(i))
        return S || (u.value = i), !0;
    }
    const p = d ? Number(s) < t.length : de(t, s), g = Reflect.set(
      t,
      s,
      i,
      /* @__PURE__ */ Ne(t) ? t : a
    );
    return t === /* @__PURE__ */ ue(a) && (p ? yt(i, u) && Tt(t, "set", s, i) : Tt(t, "add", s, i)), g;
  }
  deleteProperty(t, s) {
    const i = de(t, s);
    t[s];
    const a = Reflect.deleteProperty(t, s);
    return a && i && Tt(t, "delete", s, void 0), a;
  }
  has(t, s) {
    const i = Reflect.has(t, s);
    return (!xt(s) || !wo.has(s)) && Fe(t, "has", s), i;
  }
  ownKeys(t) {
    return Fe(
      t,
      "iterate",
      X(t) ? "length" : Xt
    ), Reflect.ownKeys(t);
  }
}
class fa extends Co {
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
const va = /* @__PURE__ */ new Mo(), ga = /* @__PURE__ */ new fa(), ma = /* @__PURE__ */ new Mo(!0);
const Fs = (e) => e, Un = (e) => Reflect.getPrototypeOf(e);
function _a(e, t, s) {
  return function(...i) {
    const a = this.__v_raw, u = /* @__PURE__ */ ue(a), d = ln(u), p = e === "entries" || e === Symbol.iterator && d, g = e === "keys" && d, S = a[e](...i), b = s ? Fs : t ? rn : dt;
    return !t && Fe(
      u,
      "iterate",
      g ? $s : Xt
    ), Le(
      // inheriting all iterator properties
      Object.create(S),
      {
        // iterator protocol
        next() {
          const { value: w, done: V } = S.next();
          return V ? { value: w, done: V } : {
            value: p ? [b(w[0]), b(w[1])] : b(w),
            done: V
          };
        }
      }
    );
  };
}
function Kn(e) {
  return function(...t) {
    return e === "delete" ? !1 : e === "clear" ? void 0 : this;
  };
}
function ha(e, t) {
  const s = {
    get(a) {
      const u = this.__v_raw, d = /* @__PURE__ */ ue(u), p = /* @__PURE__ */ ue(a);
      e || (yt(a, p) && Fe(d, "get", a), Fe(d, "get", p));
      const { has: g } = Un(d), S = t ? Fs : e ? rn : dt;
      if (g.call(d, a))
        return S(u.get(a));
      if (g.call(d, p))
        return S(u.get(p));
      u !== d && u.get(a);
    },
    get size() {
      const a = this.__v_raw;
      return !e && Fe(/* @__PURE__ */ ue(a), "iterate", Xt), a.size;
    },
    has(a) {
      const u = this.__v_raw, d = /* @__PURE__ */ ue(u), p = /* @__PURE__ */ ue(a);
      return e || (yt(a, p) && Fe(d, "has", a), Fe(d, "has", p)), a === p ? u.has(a) : u.has(a) || u.has(p);
    },
    forEach(a, u) {
      const d = this, p = d.__v_raw, g = /* @__PURE__ */ ue(p), S = t ? Fs : e ? rn : dt;
      return !e && Fe(g, "iterate", Xt), p.forEach((b, w) => a.call(u, S(b), S(w), d));
    }
  };
  return Le(
    s,
    e ? {
      add: Kn("add"),
      set: Kn("set"),
      delete: Kn("delete"),
      clear: Kn("clear")
    } : {
      add(a) {
        const u = /* @__PURE__ */ ue(this), d = Un(u), p = /* @__PURE__ */ ue(a), g = !t && !/* @__PURE__ */ nt(a) && !/* @__PURE__ */ Vt(a) ? p : a;
        return d.has.call(u, g) || yt(a, g) && d.has.call(u, a) || yt(p, g) && d.has.call(u, p) || (u.add(g), Tt(u, "add", g, g)), this;
      },
      set(a, u) {
        !t && !/* @__PURE__ */ nt(u) && !/* @__PURE__ */ Vt(u) && (u = /* @__PURE__ */ ue(u));
        const d = /* @__PURE__ */ ue(this), { has: p, get: g } = Un(d);
        let S = p.call(d, a);
        S || (a = /* @__PURE__ */ ue(a), S = p.call(d, a));
        const b = g.call(d, a);
        return d.set(a, u), S ? yt(u, b) && Tt(d, "set", a, u) : Tt(d, "add", a, u), this;
      },
      delete(a) {
        const u = /* @__PURE__ */ ue(this), { has: d, get: p } = Un(u);
        let g = d.call(u, a);
        g || (a = /* @__PURE__ */ ue(a), g = d.call(u, a)), p && p.call(u, a);
        const S = u.delete(a);
        return g && Tt(u, "delete", a, void 0), S;
      },
      clear() {
        const a = /* @__PURE__ */ ue(this), u = a.size !== 0, d = a.clear();
        return u && Tt(
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
    s[a] = _a(a, e, t);
  }), s;
}
function tl(e, t) {
  const s = ha(e, t);
  return (i, a, u) => a === "__v_isReactive" ? !e : a === "__v_isReadonly" ? e : a === "__v_raw" ? i : Reflect.get(
    de(s, a) && a in i ? s : i,
    a,
    u
  );
}
const ya = {
  get: /* @__PURE__ */ tl(!1, !1)
}, ba = {
  get: /* @__PURE__ */ tl(!1, !0)
}, xa = {
  get: /* @__PURE__ */ tl(!0, !1)
};
const Ro = /* @__PURE__ */ new WeakMap(), To = /* @__PURE__ */ new WeakMap(), Eo = /* @__PURE__ */ new WeakMap(), Sa = /* @__PURE__ */ new WeakMap();
function ka(e) {
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
function wa(e) {
  return e.__v_skip || !Object.isExtensible(e) ? 0 : ka(Gi(e));
}
// @__NO_SIDE_EFFECTS__
function nl(e) {
  return /* @__PURE__ */ Vt(e) ? e : sl(
    e,
    !1,
    va,
    ya,
    Ro
  );
}
// @__NO_SIDE_EFFECTS__
function Ca(e) {
  return sl(
    e,
    !1,
    ma,
    ba,
    To
  );
}
// @__NO_SIDE_EFFECTS__
function Ns(e) {
  return sl(
    e,
    !0,
    ga,
    xa,
    Eo
  );
}
function sl(e, t, s, i, a) {
  if (!ge(e) || e.__v_raw && !(t && e.__v_isReactive))
    return e;
  const u = wa(e);
  if (u === 0)
    return e;
  const d = a.get(e);
  if (d)
    return d;
  const p = new Proxy(
    e,
    u === 2 ? i : s
  );
  return a.set(e, p), p;
}
// @__NO_SIDE_EFFECTS__
function Jt(e) {
  return /* @__PURE__ */ Vt(e) ? /* @__PURE__ */ Jt(e.__v_raw) : !!(e && e.__v_isReactive);
}
// @__NO_SIDE_EFFECTS__
function Vt(e) {
  return !!(e && e.__v_isReadonly);
}
// @__NO_SIDE_EFFECTS__
function nt(e) {
  return !!(e && e.__v_isShallow);
}
// @__NO_SIDE_EFFECTS__
function ll(e) {
  return e ? !!e.__v_raw : !1;
}
// @__NO_SIDE_EFFECTS__
function ue(e) {
  const t = e && e.__v_raw;
  return t ? /* @__PURE__ */ ue(t) : e;
}
function Ma(e) {
  return !de(e, "__v_skip") && Object.isExtensible(e) && po(e, "__v_skip", !0), e;
}
const dt = (e) => ge(e) ? /* @__PURE__ */ nl(e) : e, rn = (e) => ge(e) ? /* @__PURE__ */ Ns(e) : e;
// @__NO_SIDE_EFFECTS__
function Ne(e) {
  return e ? e.__v_isRef === !0 : !1;
}
// @__NO_SIDE_EFFECTS__
function me(e) {
  return Ra(e, !1);
}
function Ra(e, t) {
  return /* @__PURE__ */ Ne(e) ? e : new Ta(e, t);
}
class Ta {
  constructor(t, s) {
    this.dep = new el(), this.__v_isRef = !0, this.__v_isShallow = !1, this._rawValue = s ? t : /* @__PURE__ */ ue(t), this._value = s ? t : dt(t), this.__v_isShallow = s;
  }
  get value() {
    return this.dep.track(), this._value;
  }
  set value(t) {
    const s = this._rawValue, i = this.__v_isShallow || /* @__PURE__ */ nt(t) || /* @__PURE__ */ Vt(t);
    t = i ? t : /* @__PURE__ */ ue(t), yt(t, s) && (this._rawValue = t, this._value = i ? t : dt(t), this.dep.trigger());
  }
}
function Ea(e) {
  return /* @__PURE__ */ Ne(e) ? e.value : e;
}
const Pa = {
  get: (e, t, s) => t === "__v_raw" ? e : Ea(Reflect.get(e, t, s)),
  set: (e, t, s, i) => {
    const a = e[t];
    return /* @__PURE__ */ Ne(a) && !/* @__PURE__ */ Ne(s) ? (a.value = s, !0) : Reflect.set(e, t, s, i);
  }
};
function Po(e) {
  return /* @__PURE__ */ Jt(e) ? e : new Proxy(e, Pa);
}
class Aa {
  constructor(t, s, i) {
    this.fn = t, this.setter = s, this._value = void 0, this.dep = new el(this), this.__v_isRef = !0, this.deps = void 0, this.depsTail = void 0, this.flags = 16, this.globalVersion = Pn - 1, this.next = void 0, this.effect = this, this.__v_isReadonly = !s, this.isSSR = i;
  }
  /**
   * @internal
   */
  notify() {
    if (this.flags |= 16, !(this.flags & 8) && // avoid infinite self recursion
    ye !== this)
      return ho(this, !0), !0;
  }
  get value() {
    const t = this.dep.track();
    return xo(this), t && (t.version = this.dep.version), this._value;
  }
  set value(t) {
    this.setter && this.setter(t);
  }
}
// @__NO_SIDE_EFFECTS__
function Da(e, t, s = !1) {
  let i, a;
  return ee(e) ? i = e : (i = e.get, a = e.set), new Aa(i, a, s);
}
const Hn = {}, Qn = /* @__PURE__ */ new WeakMap();
let Qt;
function Ia(e, t = !1, s = Qt) {
  if (s) {
    let i = Qn.get(s);
    i || Qn.set(s, i = []), i.push(e);
  }
}
function Va(e, t, s = _e) {
  const { immediate: i, deep: a, once: u, scheduler: d, augmentJob: p, call: g } = s, S = (U) => a ? U : /* @__PURE__ */ nt(U) || a === !1 || a === 0 ? Et(U, 1) : Et(U);
  let b, w, V, L, Z = !1, W = !1;
  if (/* @__PURE__ */ Ne(e) ? (w = () => e.value, Z = /* @__PURE__ */ nt(e)) : /* @__PURE__ */ Jt(e) ? (w = () => S(e), Z = !0) : X(e) ? (W = !0, Z = e.some((U) => /* @__PURE__ */ Jt(U) || /* @__PURE__ */ nt(U)), w = () => e.map((U) => {
    if (/* @__PURE__ */ Ne(U))
      return U.value;
    if (/* @__PURE__ */ Jt(U))
      return S(U);
    if (ee(U))
      return g ? g(U, 2) : U();
  })) : ee(e) ? t ? w = g ? () => g(e, 2) : e : w = () => {
    if (V) {
      Dt();
      try {
        V();
      } finally {
        It();
      }
    }
    const U = Qt;
    Qt = b;
    try {
      return g ? g(e, 3, [L]) : e(L);
    } finally {
      Qt = U;
    }
  } : w = bt, t && a) {
    const U = w, se = a === !0 ? 1 / 0 : a;
    w = () => Et(U(), se);
  }
  const ae = ia(), F = () => {
    b.stop(), ae && ae.active && Ys(ae.effects, b);
  };
  if (u && t) {
    const U = t;
    t = (...se) => {
      U(...se), F();
    };
  }
  let G = W ? new Array(e.length).fill(Hn) : Hn;
  const ne = (U) => {
    if (!(!(b.flags & 1) || !b.dirty && !U))
      if (t) {
        const se = b.run();
        if (a || Z || (W ? se.some((Ee, Pe) => yt(Ee, G[Pe])) : yt(se, G))) {
          V && V();
          const Ee = Qt;
          Qt = b;
          try {
            const Pe = [
              se,
              // pass undefined as the old value when it's changed for the first time
              G === Hn ? void 0 : W && G[0] === Hn ? [] : G,
              L
            ];
            G = se, g ? g(t, 3, Pe) : (
              // @ts-expect-error
              t(...Pe)
            );
          } finally {
            Qt = Ee;
          }
        }
      } else
        b.run();
  };
  return p && p(ne), b = new mo(w), b.scheduler = d ? () => d(ne, !1) : ne, L = (U) => Ia(U, !1, b), V = b.onStop = () => {
    const U = Qn.get(b);
    if (U) {
      if (g)
        g(U, 4);
      else
        for (const se of U) se();
      Qn.delete(b);
    }
  }, t ? i ? ne(!0) : G = b.run() : d ? d(ne.bind(null, !0), !0) : b.run(), F.pause = b.pause.bind(b), F.resume = b.resume.bind(b), F.stop = F, F;
}
function Et(e, t = 1 / 0, s) {
  if (t <= 0 || !ge(e) || e.__v_skip || (s = s || /* @__PURE__ */ new Map(), (s.get(e) || 0) >= t))
    return e;
  if (s.set(e, t), t--, /* @__PURE__ */ Ne(e))
    Et(e.value, t, s);
  else if (X(e))
    for (let i = 0; i < e.length; i++)
      Et(e[i], t, s);
  else if (dn(e) || ln(e))
    e.forEach((i) => {
      Et(i, t, s);
    });
  else if (co(e)) {
    for (const i in e)
      Et(e[i], t, s);
    for (const i of Object.getOwnPropertySymbols(e))
      Object.prototype.propertyIsEnumerable.call(e, i) && Et(e[i], t, s);
  }
  return e;
}
function Fn(e, t, s, i) {
  try {
    return i ? e(...i) : e();
  } catch (a) {
    rs(a, t, s);
  }
}
function St(e, t, s, i) {
  if (ee(e)) {
    const a = Fn(e, t, s, i);
    return a && ao(a) && a.catch((u) => {
      rs(u, t, s);
    }), a;
  }
  if (X(e)) {
    const a = [];
    for (let u = 0; u < e.length; u++)
      a.push(St(e[u], t, s, i));
    return a;
  }
}
function rs(e, t, s, i = !0) {
  const a = t ? t.vnode : null, { errorHandler: u, throwUnhandledErrorInProduction: d } = t && t.appContext.config || _e;
  if (t) {
    let p = t.parent;
    const g = t.proxy, S = `https://vuejs.org/error-reference/#runtime-${s}`;
    for (; p; ) {
      const b = p.ec;
      if (b) {
        for (let w = 0; w < b.length; w++)
          if (b[w](e, g, S) === !1)
            return;
      }
      p = p.parent;
    }
    if (u) {
      Dt(), Fn(u, null, 10, [
        e,
        g,
        S
      ]), It();
      return;
    }
  }
  Oa(e, s, a, i, d);
}
function Oa(e, t, s, i = !0, a = !1) {
  if (a)
    throw e;
  console.error(e);
}
const We = [];
let mt = -1;
const on = [];
let jt = null, nn = 0;
const Ao = /* @__PURE__ */ Promise.resolve();
let Xn = null;
function Do(e) {
  const t = Xn || Ao;
  return e ? t.then(this ? e.bind(this) : e) : t;
}
function $a(e) {
  let t = mt + 1, s = We.length;
  for (; t < s; ) {
    const i = t + s >>> 1, a = We[i], u = Dn(a);
    u < e || u === e && a.flags & 2 ? t = i + 1 : s = i;
  }
  return t;
}
function ol(e) {
  if (!(e.flags & 1)) {
    const t = Dn(e), s = We[We.length - 1];
    !s || // fast path when the job id is larger than the tail
    !(e.flags & 2) && t >= Dn(s) ? We.push(e) : We.splice($a(t), 0, e), e.flags |= 1, Io();
  }
}
function Io() {
  Xn || (Xn = Ao.then(Oo));
}
function Fa(e) {
  X(e) ? on.push(...e) : jt && e.id === -1 ? jt.splice(nn + 1, 0, e) : e.flags & 1 || (on.push(e), e.flags |= 1), Io();
}
function El(e, t, s = mt + 1) {
  for (; s < We.length; s++) {
    const i = We[s];
    if (i && i.flags & 2) {
      if (e && i.id !== e.uid)
        continue;
      We.splice(s, 1), s--, i.flags & 4 && (i.flags &= -2), i(), i.flags & 4 || (i.flags &= -2);
    }
  }
}
function Vo(e) {
  if (on.length) {
    const t = [...new Set(on)].sort(
      (s, i) => Dn(s) - Dn(i)
    );
    if (on.length = 0, jt) {
      jt.push(...t);
      return;
    }
    for (jt = t, nn = 0; nn < jt.length; nn++) {
      const s = jt[nn];
      s.flags & 4 && (s.flags &= -2), s.flags & 8 || s(), s.flags &= -2;
    }
    jt = null, nn = 0;
  }
}
const Dn = (e) => e.id == null ? e.flags & 2 ? -1 : 1 / 0 : e.id;
function Oo(e) {
  try {
    for (mt = 0; mt < We.length; mt++) {
      const t = We[mt];
      t && !(t.flags & 8) && (t.flags & 4 && (t.flags &= -2), Fn(
        t,
        t.i,
        t.i ? 15 : 14
      ), t.flags & 4 || (t.flags &= -2));
    }
  } finally {
    for (; mt < We.length; mt++) {
      const t = We[mt];
      t && (t.flags &= -2);
    }
    mt = -1, We.length = 0, Vo(), Xn = null, (We.length || on.length) && Oo();
  }
}
let tt = null, $o = null;
function Jn(e) {
  const t = tt;
  return tt = e, $o = e && e.type.__scopeId || null, t;
}
function Na(e, t = tt, s) {
  if (!t || e._n)
    return e;
  const i = (...a) => {
    i._d && jl(-1);
    const u = Jn(t);
    let d;
    try {
      d = e(...a);
    } finally {
      Jn(u), i._d && jl(1);
    }
    return d;
  };
  return i._n = !0, i._c = !0, i._d = !0, i;
}
function Te(e, t) {
  if (tt === null)
    return e;
  const s = ps(tt), i = e.dirs || (e.dirs = []);
  for (let a = 0; a < t.length; a++) {
    let [u, d, p, g = _e] = t[a];
    u && (ee(u) && (u = {
      mounted: u,
      updated: u
    }), u.deep && Et(d), i.push({
      dir: u,
      instance: s,
      value: d,
      oldValue: void 0,
      arg: p,
      modifiers: g
    }));
  }
  return e;
}
function Yt(e, t, s, i) {
  const a = e.dirs, u = t && t.dirs;
  for (let d = 0; d < a.length; d++) {
    const p = a[d];
    u && (p.oldValue = u[d].value);
    let g = p.dir[i];
    g && (Dt(), St(g, s, 8, [
      e.el,
      p,
      e,
      t
    ]), It());
  }
}
function La(e, t) {
  if (Ue) {
    let s = Ue.provides;
    const i = Ue.parent && Ue.parent.provides;
    i === s && (s = Ue.provides = Object.create(i)), s[e] = t;
  }
}
function zn(e, t, s = !1) {
  const i = Fr();
  if (i || an) {
    let a = an ? an._context.provides : i ? i.parent == null || i.ce ? i.vnode.appContext && i.vnode.appContext.provides : i.parent.provides : void 0;
    if (a && e in a)
      return a[e];
    if (arguments.length > 1)
      return s && ee(t) ? t.call(i && i.proxy) : t;
  }
}
const ja = /* @__PURE__ */ Symbol.for("v-scx"), Ba = () => zn(ja);
function kn(e, t, s) {
  return Fo(e, t, s);
}
function Fo(e, t, s = _e) {
  const { immediate: i, deep: a, flush: u, once: d } = s, p = Le({}, s), g = t && i || !t && u !== "post";
  let S;
  if (Vn) {
    if (u === "sync") {
      const L = Ba();
      S = L.__watcherHandles || (L.__watcherHandles = []);
    } else if (!g) {
      const L = () => {
      };
      return L.stop = bt, L.resume = bt, L.pause = bt, L;
    }
  }
  const b = Ue;
  p.call = (L, Z, W) => St(L, b, Z, W);
  let w = !1;
  u === "post" ? p.scheduler = (L) => {
    Ye(L, b && b.suspense);
  } : u !== "sync" && (w = !0, p.scheduler = (L, Z) => {
    Z ? L() : ol(L);
  }), p.augmentJob = (L) => {
    t && (L.flags |= 4), w && (L.flags |= 2, b && (L.id = b.uid, L.i = b));
  };
  const V = Va(e, t, p);
  return Vn && (S ? S.push(V) : g && V()), V;
}
function Wa(e, t, s) {
  const i = this.proxy, a = ke(e) ? e.includes(".") ? No(i, e) : () => i[e] : e.bind(i, i);
  let u;
  ee(t) ? u = t : (u = t.handler, s = t);
  const d = Nn(this), p = Fo(a, u.bind(i), s);
  return d(), p;
}
function No(e, t) {
  const s = t.split(".");
  return () => {
    let i = e;
    for (let a = 0; a < s.length && i; a++)
      i = i[s[a]];
    return i;
  };
}
const Ua = /* @__PURE__ */ Symbol("_vte"), Ka = (e) => e.__isTeleport, Ha = /* @__PURE__ */ Symbol("_leaveCb");
function il(e, t) {
  e.shapeFlag & 6 && e.component ? (e.transition = t, il(e.component.subTree, t)) : e.shapeFlag & 128 ? (e.ssContent.transition = t.clone(e.ssContent), e.ssFallback.transition = t.clone(e.ssFallback)) : e.transition = t;
}
function Lo(e) {
  e.ids = [e.ids[0] + e.ids[2]++ + "-", 0, 0];
}
function Pl(e, t) {
  let s;
  return !!((s = Object.getOwnPropertyDescriptor(e, t)) && !s.configurable);
}
const Zn = /* @__PURE__ */ new WeakMap();
function wn(e, t, s, i, a = !1) {
  if (X(e)) {
    e.forEach(
      (W, ae) => wn(
        W,
        t && (X(t) ? t[ae] : t),
        s,
        i,
        a
      )
    );
    return;
  }
  if (Cn(i) && !a) {
    i.shapeFlag & 512 && i.type.__asyncResolved && i.component.subTree.component && wn(e, t, s, i.component.subTree);
    return;
  }
  const u = i.shapeFlag & 4 ? ps(i.component) : i.el, d = a ? null : u, { i: p, r: g } = e, S = t && t.r, b = p.refs === _e ? p.refs = {} : p.refs, w = p.setupState, V = /* @__PURE__ */ ue(w), L = w === _e ? io : (W) => Pl(b, W) ? !1 : de(V, W), Z = (W, ae) => !(ae && Pl(b, ae));
  if (S != null && S !== g) {
    if (Al(t), ke(S))
      b[S] = null, L(S) && (w[S] = null);
    else if (/* @__PURE__ */ Ne(S)) {
      const W = t;
      Z(S, W.k) && (S.value = null), W.k && (b[W.k] = null);
    }
  }
  if (ee(g))
    Fn(g, p, 12, [d, b]);
  else {
    const W = ke(g), ae = /* @__PURE__ */ Ne(g);
    if (W || ae) {
      const F = () => {
        if (e.f) {
          const G = W ? L(g) ? w[g] : b[g] : Z() || !e.k ? g.value : b[e.k];
          if (a)
            X(G) && Ys(G, u);
          else if (X(G))
            G.includes(u) || G.push(u);
          else if (W)
            b[g] = [u], L(g) && (w[g] = b[g]);
          else {
            const ne = [u];
            Z(g, e.k) && (g.value = ne), e.k && (b[e.k] = ne);
          }
        } else W ? (b[g] = d, L(g) && (w[g] = d)) : ae && (Z(g, e.k) && (g.value = d), e.k && (b[e.k] = d));
      };
      if (d) {
        const G = () => {
          F(), Zn.delete(e);
        };
        G.id = -1, Zn.set(e, G), Ye(G, s);
      } else
        Al(e), F();
    }
  }
}
function Al(e) {
  const t = Zn.get(e);
  t && (t.flags |= 8, Zn.delete(e));
}
is().requestIdleCallback;
is().cancelIdleCallback;
const Cn = (e) => !!e.type.__asyncLoader, jo = (e) => e.type.__isKeepAlive;
function qa(e, t) {
  Bo(e, "a", t);
}
function za(e, t) {
  Bo(e, "da", t);
}
function Bo(e, t, s = Ue) {
  const i = e.__wdc || (e.__wdc = () => {
    let a = s;
    for (; a; ) {
      if (a.isDeactivated)
        return;
      a = a.parent;
    }
    return e();
  });
  if (cs(t, i, s), s) {
    let a = s.parent;
    for (; a && a.parent; )
      jo(a.parent.vnode) && Ya(i, t, s, a), a = a.parent;
  }
}
function Ya(e, t, s, i) {
  const a = cs(
    t,
    e,
    i,
    !0
    /* prepend */
  );
  Ko(() => {
    Ys(i[t], a);
  }, s);
}
function cs(e, t, s = Ue, i = !1) {
  if (s) {
    const a = s[e] || (s[e] = []), u = t.__weh || (t.__weh = (...d) => {
      Dt();
      const p = Nn(s), g = St(t, s, e, d);
      return p(), It(), g;
    });
    return i ? a.unshift(u) : a.push(u), u;
  }
}
const Ot = (e) => (t, s = Ue) => {
  (!Vn || e === "sp") && cs(e, (...i) => t(...i), s);
}, Ga = Ot("bm"), Wo = Ot("m"), Qa = Ot(
  "bu"
), Xa = Ot("u"), Uo = Ot(
  "bum"
), Ko = Ot("um"), Ja = Ot(
  "sp"
), Za = Ot("rtg"), er = Ot("rtc");
function tr(e, t = Ue) {
  cs("ec", e, t);
}
const nr = /* @__PURE__ */ Symbol.for("v-ndc");
function D(e, t, s, i) {
  let a;
  const u = s, d = X(e);
  if (d || ke(e)) {
    const p = d && /* @__PURE__ */ Jt(e);
    let g = !1, S = !1;
    p && (g = !/* @__PURE__ */ nt(e), S = /* @__PURE__ */ Vt(e), e = as(e)), a = new Array(e.length);
    for (let b = 0, w = e.length; b < w; b++)
      a[b] = t(
        g ? S ? rn(dt(e[b])) : dt(e[b]) : e[b],
        b,
        void 0,
        u
      );
  } else if (typeof e == "number") {
    a = new Array(e);
    for (let p = 0; p < e; p++)
      a[p] = t(p + 1, p, void 0, u);
  } else if (ge(e))
    if (e[Symbol.iterator])
      a = Array.from(
        e,
        (p, g) => t(p, g, void 0, u)
      );
    else {
      const p = Object.keys(e);
      a = new Array(p.length);
      for (let g = 0, S = p.length; g < S; g++) {
        const b = p[g];
        a[g] = t(e[b], b, g, u);
      }
    }
  else
    a = [];
  return a;
}
const Ls = (e) => e ? di(e) ? ps(e) : Ls(e.parent) : null, Mn = (
  // Move PURE marker to new line to workaround compiler discarding it
  // due to type annotation
  /* @__PURE__ */ Le(/* @__PURE__ */ Object.create(null), {
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
    $options: (e) => qo(e),
    $forceUpdate: (e) => e.f || (e.f = () => {
      ol(e.update);
    }),
    $nextTick: (e) => e.n || (e.n = Do.bind(e.proxy)),
    $watch: (e) => Wa.bind(e)
  })
), Ts = (e, t) => e !== _e && !e.__isScriptSetup && de(e, t), sr = {
  get({ _: e }, t) {
    if (t === "__v_skip")
      return !0;
    const { ctx: s, setupState: i, data: a, props: u, accessCache: d, type: p, appContext: g } = e;
    if (t[0] !== "$") {
      const V = d[t];
      if (V !== void 0)
        switch (V) {
          case 1:
            return i[t];
          case 2:
            return a[t];
          case 4:
            return s[t];
          case 3:
            return u[t];
        }
      else {
        if (Ts(i, t))
          return d[t] = 1, i[t];
        if (a !== _e && de(a, t))
          return d[t] = 2, a[t];
        if (de(u, t))
          return d[t] = 3, u[t];
        if (s !== _e && de(s, t))
          return d[t] = 4, s[t];
        js && (d[t] = 0);
      }
    }
    const S = Mn[t];
    let b, w;
    if (S)
      return t === "$attrs" && Fe(e.attrs, "get", ""), S(e);
    if (
      // css module (injected by vue-loader)
      (b = p.__cssModules) && (b = b[t])
    )
      return b;
    if (s !== _e && de(s, t))
      return d[t] = 4, s[t];
    if (
      // global properties
      w = g.config.globalProperties, de(w, t)
    )
      return w[t];
  },
  set({ _: e }, t, s) {
    const { data: i, setupState: a, ctx: u } = e;
    return Ts(a, t) ? (a[t] = s, !0) : i !== _e && de(i, t) ? (i[t] = s, !0) : de(e.props, t) || t[0] === "$" && t.slice(1) in e ? !1 : (u[t] = s, !0);
  },
  has({
    _: { data: e, setupState: t, accessCache: s, ctx: i, appContext: a, props: u, type: d }
  }, p) {
    let g;
    return !!(s[p] || e !== _e && p[0] !== "$" && de(e, p) || Ts(t, p) || de(u, p) || de(i, p) || de(Mn, p) || de(a.config.globalProperties, p) || (g = d.__cssModules) && g[p]);
  },
  defineProperty(e, t, s) {
    return s.get != null ? e._.accessCache[t] = 0 : de(s, "value") && this.set(e, t, s.value, null), Reflect.defineProperty(e, t, s);
  }
};
function Dl(e) {
  return X(e) ? e.reduce(
    (t, s) => (t[s] = null, t),
    {}
  ) : e;
}
let js = !0;
function lr(e) {
  const t = qo(e), s = e.proxy, i = e.ctx;
  js = !1, t.beforeCreate && Il(t.beforeCreate, e, "bc");
  const {
    // state
    data: a,
    computed: u,
    methods: d,
    watch: p,
    provide: g,
    inject: S,
    // lifecycle
    created: b,
    beforeMount: w,
    mounted: V,
    beforeUpdate: L,
    updated: Z,
    activated: W,
    deactivated: ae,
    beforeDestroy: F,
    beforeUnmount: G,
    destroyed: ne,
    unmounted: U,
    render: se,
    renderTracked: Ee,
    renderTriggered: Pe,
    errorCaptured: Ke,
    serverPrefetch: pt,
    // public API
    expose: K,
    inheritAttrs: we,
    // assets
    components: He,
    directives: x,
    filters: B
  } = t;
  if (S && or(S, i, null), d)
    for (const ce in d) {
      const ie = d[ce];
      ee(ie) && (i[ce] = ie.bind(s));
    }
  if (a) {
    const ce = a.call(s, s);
    ge(ce) && (e.data = /* @__PURE__ */ nl(ce));
  }
  if (js = !0, u)
    for (const ce in u) {
      const ie = u[ce], st = ee(ie) ? ie.bind(s, s) : ee(ie.get) ? ie.get.bind(s, s) : bt, ft = !ee(ie) && ee(ie.set) ? ie.set.bind(s) : bt, lt = fe({
        get: st,
        set: ft
      });
      Object.defineProperty(i, ce, {
        enumerable: !0,
        configurable: !0,
        get: () => lt.value,
        set: (Ae) => lt.value = Ae
      });
    }
  if (p)
    for (const ce in p)
      Ho(p[ce], i, s, ce);
  if (g) {
    const ce = ee(g) ? g.call(s) : g;
    Reflect.ownKeys(ce).forEach((ie) => {
      La(ie, ce[ie]);
    });
  }
  b && Il(b, e, "c");
  function he(ce, ie) {
    X(ie) ? ie.forEach((st) => ce(st.bind(s))) : ie && ce(ie.bind(s));
  }
  if (he(Ga, w), he(Wo, V), he(Qa, L), he(Xa, Z), he(qa, W), he(za, ae), he(tr, Ke), he(er, Ee), he(Za, Pe), he(Uo, G), he(Ko, U), he(Ja, pt), X(K))
    if (K.length) {
      const ce = e.exposed || (e.exposed = {});
      K.forEach((ie) => {
        Object.defineProperty(ce, ie, {
          get: () => s[ie],
          set: (st) => s[ie] = st,
          enumerable: !0
        });
      });
    } else e.exposed || (e.exposed = {});
  se && e.render === bt && (e.render = se), we != null && (e.inheritAttrs = we), He && (e.components = He), x && (e.directives = x), pt && Lo(e);
}
function or(e, t, s = bt) {
  X(e) && (e = Bs(e));
  for (const i in e) {
    const a = e[i];
    let u;
    ge(a) ? "default" in a ? u = zn(
      a.from || i,
      a.default,
      !0
    ) : u = zn(a.from || i) : u = zn(a), /* @__PURE__ */ Ne(u) ? Object.defineProperty(t, i, {
      enumerable: !0,
      configurable: !0,
      get: () => u.value,
      set: (d) => u.value = d
    }) : t[i] = u;
  }
}
function Il(e, t, s) {
  St(
    X(e) ? e.map((i) => i.bind(t.proxy)) : e.bind(t.proxy),
    t,
    s
  );
}
function Ho(e, t, s, i) {
  let a = i.includes(".") ? No(s, i) : () => s[i];
  if (ke(e)) {
    const u = t[e];
    ee(u) && kn(a, u);
  } else if (ee(e))
    kn(a, e.bind(s));
  else if (ge(e))
    if (X(e))
      e.forEach((u) => Ho(u, t, s, i));
    else {
      const u = ee(e.handler) ? e.handler.bind(s) : t[e.handler];
      ee(u) && kn(a, u, e);
    }
}
function qo(e) {
  const t = e.type, { mixins: s, extends: i } = t, {
    mixins: a,
    optionsCache: u,
    config: { optionMergeStrategies: d }
  } = e.appContext, p = u.get(t);
  let g;
  return p ? g = p : !a.length && !s && !i ? g = t : (g = {}, a.length && a.forEach(
    (S) => es(g, S, d, !0)
  ), es(g, t, d)), ge(t) && u.set(t, g), g;
}
function es(e, t, s, i = !1) {
  const { mixins: a, extends: u } = t;
  u && es(e, u, s, !0), a && a.forEach(
    (d) => es(e, d, s, !0)
  );
  for (const d in t)
    if (!(i && d === "expose")) {
      const p = ir[d] || s && s[d];
      e[d] = p ? p(e[d], t[d]) : t[d];
    }
  return e;
}
const ir = {
  data: Vl,
  props: Ol,
  emits: Ol,
  // objects
  methods: hn,
  computed: hn,
  // lifecycle
  beforeCreate: Be,
  created: Be,
  beforeMount: Be,
  mounted: Be,
  beforeUpdate: Be,
  updated: Be,
  beforeDestroy: Be,
  beforeUnmount: Be,
  destroyed: Be,
  unmounted: Be,
  activated: Be,
  deactivated: Be,
  errorCaptured: Be,
  serverPrefetch: Be,
  // assets
  components: hn,
  directives: hn,
  // watch
  watch: rr,
  // provide / inject
  provide: Vl,
  inject: ar
};
function Vl(e, t) {
  return t ? e ? function() {
    return Le(
      ee(e) ? e.call(this, this) : e,
      ee(t) ? t.call(this, this) : t
    );
  } : t : e;
}
function ar(e, t) {
  return hn(Bs(e), Bs(t));
}
function Bs(e) {
  if (X(e)) {
    const t = {};
    for (let s = 0; s < e.length; s++)
      t[e[s]] = e[s];
    return t;
  }
  return e;
}
function Be(e, t) {
  return e ? [...new Set([].concat(e, t))] : t;
}
function hn(e, t) {
  return e ? Le(/* @__PURE__ */ Object.create(null), e, t) : t;
}
function Ol(e, t) {
  return e ? X(e) && X(t) ? [.../* @__PURE__ */ new Set([...e, ...t])] : Le(
    /* @__PURE__ */ Object.create(null),
    Dl(e),
    Dl(t ?? {})
  ) : t;
}
function rr(e, t) {
  if (!e) return t;
  if (!t) return e;
  const s = Le(/* @__PURE__ */ Object.create(null), e);
  for (const i in t)
    s[i] = Be(e[i], t[i]);
  return s;
}
function zo() {
  return {
    app: null,
    config: {
      isNativeTag: io,
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
function ur(e, t) {
  return function(i, a = null) {
    ee(i) || (i = Le({}, i)), a != null && !ge(a) && (a = null);
    const u = zo(), d = /* @__PURE__ */ new WeakSet(), p = [];
    let g = !1;
    const S = u.app = {
      _uid: cr++,
      _component: i,
      _props: a,
      _container: null,
      _context: u,
      _instance: null,
      version: Ur,
      get config() {
        return u.config;
      },
      set config(b) {
      },
      use(b, ...w) {
        return d.has(b) || (b && ee(b.install) ? (d.add(b), b.install(S, ...w)) : ee(b) && (d.add(b), b(S, ...w))), S;
      },
      mixin(b) {
        return u.mixins.includes(b) || u.mixins.push(b), S;
      },
      component(b, w) {
        return w ? (u.components[b] = w, S) : u.components[b];
      },
      directive(b, w) {
        return w ? (u.directives[b] = w, S) : u.directives[b];
      },
      mount(b, w, V) {
        if (!g) {
          const L = S._ceVNode || Pt(i, a);
          return L.appContext = u, V === !0 ? V = "svg" : V === !1 && (V = void 0), e(L, b, V), g = !0, S._container = b, b.__vue_app__ = S, ps(L.component);
        }
      },
      onUnmount(b) {
        p.push(b);
      },
      unmount() {
        g && (St(
          p,
          S._instance,
          16
        ), e(null, S._container), delete S._container.__vue_app__);
      },
      provide(b, w) {
        return u.provides[b] = w, S;
      },
      runWithContext(b) {
        const w = an;
        an = S;
        try {
          return b();
        } finally {
          an = w;
        }
      }
    };
    return S;
  };
}
let an = null;
const dr = (e, t) => t === "modelValue" || t === "model-value" ? e.modelModifiers : e[`${t}Modifiers`] || e[`${ct(t)}Modifiers`] || e[`${Kt(t)}Modifiers`];
function pr(e, t, ...s) {
  if (e.isUnmounted) return;
  const i = e.vnode.props || _e;
  let a = s;
  const u = t.startsWith("update:"), d = u && dr(i, t.slice(7));
  d && (d.trim && (a = s.map((b) => ke(b) ? b.trim() : b)), d.number && (a = s.map(os)));
  let p, g = i[p = ks(t)] || // also try camelCase event handler (#2249)
  i[p = ks(ct(t))];
  !g && u && (g = i[p = ks(Kt(t))]), g && St(
    g,
    e,
    6,
    a
  );
  const S = i[p + "Once"];
  if (S) {
    if (!e.emitted)
      e.emitted = {};
    else if (e.emitted[p])
      return;
    e.emitted[p] = !0, St(
      S,
      e,
      6,
      a
    );
  }
}
const fr = /* @__PURE__ */ new WeakMap();
function Yo(e, t, s = !1) {
  const i = s ? fr : t.emitsCache, a = i.get(e);
  if (a !== void 0)
    return a;
  const u = e.emits;
  let d = {}, p = !1;
  if (!ee(e)) {
    const g = (S) => {
      const b = Yo(S, t, !0);
      b && (p = !0, Le(d, b));
    };
    !s && t.mixins.length && t.mixins.forEach(g), e.extends && g(e.extends), e.mixins && e.mixins.forEach(g);
  }
  return !u && !p ? (ge(e) && i.set(e, null), null) : (X(u) ? u.forEach((g) => d[g] = null) : Le(d, u), ge(e) && i.set(e, d), d);
}
function us(e, t) {
  return !e || !ns(t) ? !1 : (t = t.slice(2).replace(/Once$/, ""), de(e, t[0].toLowerCase() + t.slice(1)) || de(e, Kt(t)) || de(e, t));
}
function $l(e) {
  const {
    type: t,
    vnode: s,
    proxy: i,
    withProxy: a,
    propsOptions: [u],
    slots: d,
    attrs: p,
    emit: g,
    render: S,
    renderCache: b,
    props: w,
    data: V,
    setupState: L,
    ctx: Z,
    inheritAttrs: W
  } = e, ae = Jn(e);
  let F, G;
  try {
    if (s.shapeFlag & 4) {
      const U = a || i, se = U;
      F = ht(
        S.call(
          se,
          U,
          b,
          w,
          L,
          V,
          Z
        )
      ), G = p;
    } else {
      const U = t;
      F = ht(
        U.length > 1 ? U(
          w,
          { attrs: p, slots: d, emit: g }
        ) : U(
          w,
          null
        )
      ), G = t.props ? p : vr(p);
    }
  } catch (U) {
    Rn.length = 0, rs(U, e, 1), F = Pt(Ut);
  }
  let ne = F;
  if (G && W !== !1) {
    const U = Object.keys(G), { shapeFlag: se } = ne;
    U.length && se & 7 && (u && U.some(ss) && (G = gr(
      G,
      u
    )), ne = cn(ne, G, !1, !0));
  }
  return s.dirs && (ne = cn(ne, null, !1, !0), ne.dirs = ne.dirs ? ne.dirs.concat(s.dirs) : s.dirs), s.transition && il(ne, s.transition), F = ne, Jn(ae), F;
}
const vr = (e) => {
  let t;
  for (const s in e)
    (s === "class" || s === "style" || ns(s)) && ((t || (t = {}))[s] = e[s]);
  return t;
}, gr = (e, t) => {
  const s = {};
  for (const i in e)
    (!ss(i) || !(i.slice(9) in t)) && (s[i] = e[i]);
  return s;
};
function mr(e, t, s) {
  const { props: i, children: a, component: u } = e, { props: d, children: p, patchFlag: g } = t, S = u.emitsOptions;
  if (t.dirs || t.transition)
    return !0;
  if (s && g >= 0) {
    if (g & 1024)
      return !0;
    if (g & 16)
      return i ? Fl(i, d, S) : !!d;
    if (g & 8) {
      const b = t.dynamicProps;
      for (let w = 0; w < b.length; w++) {
        const V = b[w];
        if (Go(d, i, V) && !us(S, V))
          return !0;
      }
    }
  } else
    return (a || p) && (!p || !p.$stable) ? !0 : i === d ? !1 : i ? d ? Fl(i, d, S) : !0 : !!d;
  return !1;
}
function Fl(e, t, s) {
  const i = Object.keys(t);
  if (i.length !== Object.keys(e).length)
    return !0;
  for (let a = 0; a < i.length; a++) {
    const u = i[a];
    if (Go(t, e, u) && !us(s, u))
      return !0;
  }
  return !1;
}
function Go(e, t, s) {
  const i = e[s], a = t[s];
  return s === "style" && ge(i) && ge(a) ? !pn(i, a) : i !== a;
}
function _r({ vnode: e, parent: t, suspense: s }, i) {
  for (; t; ) {
    const a = t.subTree;
    if (a.suspense && a.suspense.activeBranch === e && (a.suspense.vnode.el = a.el = i, e = a), a === e)
      (e = t.vnode).el = i, t = t.parent;
    else
      break;
  }
  s && s.activeBranch === e && (s.vnode.el = i);
}
const Qo = {}, Xo = () => Object.create(Qo), Jo = (e) => Object.getPrototypeOf(e) === Qo;
function hr(e, t, s, i = !1) {
  const a = {}, u = Xo();
  e.propsDefaults = /* @__PURE__ */ Object.create(null), Zo(e, t, a, u);
  for (const d in e.propsOptions[0])
    d in a || (a[d] = void 0);
  s ? e.props = i ? a : /* @__PURE__ */ Ca(a) : e.type.props ? e.props = a : e.props = u, e.attrs = u;
}
function yr(e, t, s, i) {
  const {
    props: a,
    attrs: u,
    vnode: { patchFlag: d }
  } = e, p = /* @__PURE__ */ ue(a), [g] = e.propsOptions;
  let S = !1;
  if (
    // always force full diff in dev
    // - #1942 if hmr is enabled with sfc component
    // - vite#872 non-sfc component used by sfc component
    (i || d > 0) && !(d & 16)
  ) {
    if (d & 8) {
      const b = e.vnode.dynamicProps;
      for (let w = 0; w < b.length; w++) {
        let V = b[w];
        if (us(e.emitsOptions, V))
          continue;
        const L = t[V];
        if (g)
          if (de(u, V))
            L !== u[V] && (u[V] = L, S = !0);
          else {
            const Z = ct(V);
            a[Z] = Ws(
              g,
              p,
              Z,
              L,
              e,
              !1
            );
          }
        else
          L !== u[V] && (u[V] = L, S = !0);
      }
    }
  } else {
    Zo(e, t, a, u) && (S = !0);
    let b;
    for (const w in p)
      (!t || // for camelCase
      !de(t, w) && // it's possible the original props was passed in as kebab-case
      // and converted to camelCase (#955)
      ((b = Kt(w)) === w || !de(t, b))) && (g ? s && // for camelCase
      (s[w] !== void 0 || // for kebab-case
      s[b] !== void 0) && (a[w] = Ws(
        g,
        p,
        w,
        void 0,
        e,
        !0
      )) : delete a[w]);
    if (u !== p)
      for (const w in u)
        (!t || !de(t, w)) && (delete u[w], S = !0);
  }
  S && Tt(e.attrs, "set", "");
}
function Zo(e, t, s, i) {
  const [a, u] = e.propsOptions;
  let d = !1, p;
  if (t)
    for (let g in t) {
      if (bn(g))
        continue;
      const S = t[g];
      let b;
      a && de(a, b = ct(g)) ? !u || !u.includes(b) ? s[b] = S : (p || (p = {}))[b] = S : us(e.emitsOptions, g) || (!(g in i) || S !== i[g]) && (i[g] = S, d = !0);
    }
  if (u) {
    const g = /* @__PURE__ */ ue(s), S = p || _e;
    for (let b = 0; b < u.length; b++) {
      const w = u[b];
      s[w] = Ws(
        a,
        g,
        w,
        S[w],
        e,
        !de(S, w)
      );
    }
  }
  return d;
}
function Ws(e, t, s, i, a, u) {
  const d = e[s];
  if (d != null) {
    const p = de(d, "default");
    if (p && i === void 0) {
      const g = d.default;
      if (d.type !== Function && !d.skipFactory && ee(g)) {
        const { propsDefaults: S } = a;
        if (s in S)
          i = S[s];
        else {
          const b = Nn(a);
          i = S[s] = g.call(
            null,
            t
          ), b();
        }
      } else
        i = g;
      a.ce && a.ce._setProp(s, i);
    }
    d[
      0
      /* shouldCast */
    ] && (u && !p ? i = !1 : d[
      1
      /* shouldCastTrue */
    ] && (i === "" || i === Kt(s)) && (i = !0));
  }
  return i;
}
const br = /* @__PURE__ */ new WeakMap();
function ei(e, t, s = !1) {
  const i = s ? br : t.propsCache, a = i.get(e);
  if (a)
    return a;
  const u = e.props, d = {}, p = [];
  let g = !1;
  if (!ee(e)) {
    const b = (w) => {
      g = !0;
      const [V, L] = ei(w, t, !0);
      Le(d, V), L && p.push(...L);
    };
    !s && t.mixins.length && t.mixins.forEach(b), e.extends && b(e.extends), e.mixins && e.mixins.forEach(b);
  }
  if (!u && !g)
    return ge(e) && i.set(e, sn), sn;
  if (X(u))
    for (let b = 0; b < u.length; b++) {
      const w = ct(u[b]);
      Nl(w) && (d[w] = _e);
    }
  else if (u)
    for (const b in u) {
      const w = ct(b);
      if (Nl(w)) {
        const V = u[b], L = d[w] = X(V) || ee(V) ? { type: V } : Le({}, V), Z = L.type;
        let W = !1, ae = !0;
        if (X(Z))
          for (let F = 0; F < Z.length; ++F) {
            const G = Z[F], ne = ee(G) && G.name;
            if (ne === "Boolean") {
              W = !0;
              break;
            } else ne === "String" && (ae = !1);
          }
        else
          W = ee(Z) && Z.name === "Boolean";
        L[
          0
          /* shouldCast */
        ] = W, L[
          1
          /* shouldCastTrue */
        ] = ae, (W || de(L, "default")) && p.push(w);
      }
    }
  const S = [d, p];
  return ge(e) && i.set(e, S), S;
}
function Nl(e) {
  return e[0] !== "$" && !bn(e);
}
const al = (e) => e === "_" || e === "_ctx" || e === "$stable", rl = (e) => X(e) ? e.map(ht) : [ht(e)], xr = (e, t, s) => {
  if (t._n)
    return t;
  const i = Na((...a) => rl(t(...a)), s);
  return i._c = !1, i;
}, ti = (e, t, s) => {
  const i = e._ctx;
  for (const a in e) {
    if (al(a)) continue;
    const u = e[a];
    if (ee(u))
      t[a] = xr(a, u, i);
    else if (u != null) {
      const d = rl(u);
      t[a] = () => d;
    }
  }
}, ni = (e, t) => {
  const s = rl(t);
  e.slots.default = () => s;
}, si = (e, t, s) => {
  for (const i in t)
    (s || !al(i)) && (e[i] = t[i]);
}, Sr = (e, t, s) => {
  const i = e.slots = Xo();
  if (e.vnode.shapeFlag & 32) {
    const a = t._;
    a ? (si(i, t, s), s && po(i, "_", a, !0)) : ti(t, i);
  } else t && ni(e, t);
}, kr = (e, t, s) => {
  const { vnode: i, slots: a } = e;
  let u = !0, d = _e;
  if (i.shapeFlag & 32) {
    const p = t._;
    p ? s && p === 1 ? u = !1 : si(a, t, s) : (u = !t.$stable, ti(t, a)), d = t;
  } else t && (ni(e, t), d = { default: 1 });
  if (u)
    for (const p in a)
      !al(p) && d[p] == null && delete a[p];
}, Ye = Tr;
function wr(e) {
  return Cr(e);
}
function Cr(e, t) {
  const s = is();
  s.__VUE__ = !0;
  const {
    insert: i,
    remove: a,
    patchProp: u,
    createElement: d,
    createText: p,
    createComment: g,
    setText: S,
    setElementText: b,
    parentNode: w,
    nextSibling: V,
    setScopeId: L = bt,
    insertStaticContent: Z
  } = e, W = (_, y, k, R = null, M = null, C = null, N = void 0, O = null, A = !!y.dynamicChildren) => {
    if (_ === y)
      return;
    _ && !_n(_, y) && (R = Oe(_), Ae(_, M, C, !0), _ = null), y.patchFlag === -2 && (A = !1, y.dynamicChildren = null);
    const { type: E, ref: Y, shapeFlag: j } = y;
    switch (E) {
      case ds:
        ae(_, y, k, R);
        break;
      case Ut:
        F(_, y, k, R);
        break;
      case Ps:
        _ == null && G(y, k, R, N);
        break;
      case T:
        He(
          _,
          y,
          k,
          R,
          M,
          C,
          N,
          O,
          A
        );
        break;
      default:
        j & 1 ? se(
          _,
          y,
          k,
          R,
          M,
          C,
          N,
          O,
          A
        ) : j & 6 ? x(
          _,
          y,
          k,
          R,
          M,
          C,
          N,
          O,
          A
        ) : (j & 64 || j & 128) && E.process(
          _,
          y,
          k,
          R,
          M,
          C,
          N,
          O,
          A,
          ot
        );
    }
    Y != null && M ? wn(Y, _ && _.ref, C, y || _, !y) : Y == null && _ && _.ref != null && wn(_.ref, null, C, _, !0);
  }, ae = (_, y, k, R) => {
    if (_ == null)
      i(
        y.el = p(y.children),
        k,
        R
      );
    else {
      const M = y.el = _.el;
      y.children !== _.children && S(M, y.children);
    }
  }, F = (_, y, k, R) => {
    _ == null ? i(
      y.el = g(y.children || ""),
      k,
      R
    ) : y.el = _.el;
  }, G = (_, y, k, R) => {
    [_.el, _.anchor] = Z(
      _.children,
      y,
      k,
      R,
      _.el,
      _.anchor
    );
  }, ne = ({ el: _, anchor: y }, k, R) => {
    let M;
    for (; _ && _ !== y; )
      M = V(_), i(_, k, R), _ = M;
    i(y, k, R);
  }, U = ({ el: _, anchor: y }) => {
    let k;
    for (; _ && _ !== y; )
      k = V(_), a(_), _ = k;
    a(y);
  }, se = (_, y, k, R, M, C, N, O, A) => {
    if (y.type === "svg" ? N = "svg" : y.type === "math" && (N = "mathml"), _ == null)
      Ee(
        y,
        k,
        R,
        M,
        C,
        N,
        O,
        A
      );
    else {
      const E = _.el && _.el._isVueCE ? _.el : null;
      try {
        E && E._beginPatch(), pt(
          _,
          y,
          M,
          C,
          N,
          O,
          A
        );
      } finally {
        E && E._endPatch();
      }
    }
  }, Ee = (_, y, k, R, M, C, N, O) => {
    let A, E;
    const { props: Y, shapeFlag: j, transition: H, dirs: Q } = _;
    if (A = _.el = d(
      _.type,
      C,
      Y && Y.is,
      Y
    ), j & 8 ? b(A, _.children) : j & 16 && Ke(
      _.children,
      A,
      null,
      R,
      M,
      Es(_, C),
      N,
      O
    ), Q && Yt(_, null, R, "created"), Pe(A, _, _.scopeId, N, R), Y) {
      for (const pe in Y)
        pe !== "value" && !bn(pe) && u(A, pe, null, Y[pe], C, R);
      "value" in Y && u(A, "value", null, Y.value, C), (E = Y.onVnodeBeforeMount) && gt(E, R, _);
    }
    Q && Yt(_, null, R, "beforeMount");
    const le = Mr(M, H);
    le && H.beforeEnter(A), i(A, y, k), ((E = Y && Y.onVnodeMounted) || le || Q) && Ye(() => {
      E && gt(E, R, _), le && H.enter(A), Q && Yt(_, null, R, "mounted");
    }, M);
  }, Pe = (_, y, k, R, M) => {
    if (k && L(_, k), R)
      for (let C = 0; C < R.length; C++)
        L(_, R[C]);
    if (M) {
      let C = M.subTree;
      if (y === C || ai(C.type) && (C.ssContent === y || C.ssFallback === y)) {
        const N = M.vnode;
        Pe(
          _,
          N,
          N.scopeId,
          N.slotScopeIds,
          M.parent
        );
      }
    }
  }, Ke = (_, y, k, R, M, C, N, O, A = 0) => {
    for (let E = A; E < _.length; E++) {
      const Y = _[E] = O ? Rt(_[E]) : ht(_[E]);
      W(
        null,
        Y,
        y,
        k,
        R,
        M,
        C,
        N,
        O
      );
    }
  }, pt = (_, y, k, R, M, C, N) => {
    const O = y.el = _.el;
    let { patchFlag: A, dynamicChildren: E, dirs: Y } = y;
    A |= _.patchFlag & 16;
    const j = _.props || _e, H = y.props || _e;
    let Q;
    if (k && Gt(k, !1), (Q = H.onVnodeBeforeUpdate) && gt(Q, k, y, _), Y && Yt(y, _, k, "beforeUpdate"), k && Gt(k, !0), (j.innerHTML && H.innerHTML == null || j.textContent && H.textContent == null) && b(O, ""), E ? K(
      _.dynamicChildren,
      E,
      O,
      k,
      R,
      Es(y, M),
      C
    ) : N || ie(
      _,
      y,
      O,
      null,
      k,
      R,
      Es(y, M),
      C,
      !1
    ), A > 0) {
      if (A & 16)
        we(O, j, H, k, M);
      else if (A & 2 && j.class !== H.class && u(O, "class", null, H.class, M), A & 4 && u(O, "style", j.style, H.style, M), A & 8) {
        const le = y.dynamicProps;
        for (let pe = 0; pe < le.length; pe++) {
          const ve = le[pe], Se = j[ve], Ce = H[ve];
          (Ce !== Se || ve === "value") && u(O, ve, Se, Ce, M, k);
        }
      }
      A & 1 && _.children !== y.children && b(O, y.children);
    } else !N && E == null && we(O, j, H, k, M);
    ((Q = H.onVnodeUpdated) || Y) && Ye(() => {
      Q && gt(Q, k, y, _), Y && Yt(y, _, k, "updated");
    }, R);
  }, K = (_, y, k, R, M, C, N) => {
    for (let O = 0; O < y.length; O++) {
      const A = _[O], E = y[O], Y = (
        // oldVNode may be an errored async setup() component inside Suspense
        // which will not have a mounted element
        A.el && // - In the case of a Fragment, we need to provide the actual parent
        // of the Fragment itself so it can move its children.
        (A.type === T || // - In the case of different nodes, there is going to be a replacement
        // which also requires the correct parent container
        !_n(A, E) || // - In the case of a component, it could contain anything.
        A.shapeFlag & 198) ? w(A.el) : (
          // In other cases, the parent container is not actually used so we
          // just pass the block element here to avoid a DOM parentNode call.
          k
        )
      );
      W(
        A,
        E,
        Y,
        null,
        R,
        M,
        C,
        N,
        !0
      );
    }
  }, we = (_, y, k, R, M) => {
    if (y !== k) {
      if (y !== _e)
        for (const C in y)
          !bn(C) && !(C in k) && u(
            _,
            C,
            y[C],
            null,
            M,
            R
          );
      for (const C in k) {
        if (bn(C)) continue;
        const N = k[C], O = y[C];
        N !== O && C !== "value" && u(_, C, O, N, M, R);
      }
      "value" in k && u(_, "value", y.value, k.value, M);
    }
  }, He = (_, y, k, R, M, C, N, O, A) => {
    const E = y.el = _ ? _.el : p(""), Y = y.anchor = _ ? _.anchor : p("");
    let { patchFlag: j, dynamicChildren: H, slotScopeIds: Q } = y;
    Q && (O = O ? O.concat(Q) : Q), _ == null ? (i(E, k, R), i(Y, k, R), Ke(
      // #10007
      // such fragment like `<></>` will be compiled into
      // a fragment which doesn't have a children.
      // In this case fallback to an empty array
      y.children || [],
      k,
      Y,
      M,
      C,
      N,
      O,
      A
    )) : j > 0 && j & 64 && H && // #2715 the previous fragment could've been a BAILed one as a result
    // of renderSlot() with no valid children
    _.dynamicChildren && _.dynamicChildren.length === H.length ? (K(
      _.dynamicChildren,
      H,
      k,
      M,
      C,
      N,
      O
    ), // #2080 if the stable fragment has a key, it's a <template v-for> that may
    //  get moved around. Make sure all root level vnodes inherit el.
    // #2134 or if it's a component root, it may also get moved around
    // as the component is being moved.
    (y.key != null || M && y === M.subTree) && li(
      _,
      y,
      !0
      /* shallow */
    )) : ie(
      _,
      y,
      k,
      Y,
      M,
      C,
      N,
      O,
      A
    );
  }, x = (_, y, k, R, M, C, N, O, A) => {
    y.slotScopeIds = O, _ == null ? y.shapeFlag & 512 ? M.ctx.activate(
      y,
      k,
      R,
      N,
      A
    ) : B(
      y,
      k,
      R,
      M,
      C,
      N,
      A
    ) : re(_, y, A);
  }, B = (_, y, k, R, M, C, N) => {
    const O = _.component = $r(
      _,
      R,
      M
    );
    if (jo(_) && (O.ctx.renderer = ot), Nr(O, !1, N), O.asyncDep) {
      if (M && M.registerDep(O, he, N), !_.el) {
        const A = O.subTree = Pt(Ut);
        F(null, A, y, k), _.placeholder = A.el;
      }
    } else
      he(
        O,
        _,
        y,
        k,
        M,
        C,
        N
      );
  }, re = (_, y, k) => {
    const R = y.component = _.component;
    if (mr(_, y, k))
      if (R.asyncDep && !R.asyncResolved) {
        ce(R, y, k);
        return;
      } else
        R.next = y, R.update();
    else
      y.el = _.el, R.vnode = y;
  }, he = (_, y, k, R, M, C, N) => {
    const O = () => {
      if (_.isMounted) {
        let { next: j, bu: H, u: Q, parent: le, vnode: pe } = _;
        {
          const qe = oi(_);
          if (qe) {
            j && (j.el = pe.el, ce(_, j, N)), qe.asyncDep.then(() => {
              Ye(() => {
                _.isUnmounted || E();
              }, M);
            });
            return;
          }
        }
        let ve = j, Se;
        Gt(_, !1), j ? (j.el = pe.el, ce(_, j, N)) : j = pe, H && qn(H), (Se = j.props && j.props.onVnodeBeforeUpdate) && gt(Se, le, j, pe), Gt(_, !0);
        const Ce = $l(_), Ze = _.subTree;
        _.subTree = Ce, W(
          Ze,
          Ce,
          // parent may have changed if it's in a teleport
          w(Ze.el),
          // anchor may have changed if it's in a fragment
          Oe(Ze),
          _,
          M,
          C
        ), j.el = Ce.el, ve === null && _r(_, Ce.el), Q && Ye(Q, M), (Se = j.props && j.props.onVnodeUpdated) && Ye(
          () => gt(Se, le, j, pe),
          M
        );
      } else {
        let j;
        const { el: H, props: Q } = y, { bm: le, m: pe, parent: ve, root: Se, type: Ce } = _, Ze = Cn(y);
        Gt(_, !1), le && qn(le), !Ze && (j = Q && Q.onVnodeBeforeMount) && gt(j, ve, y), Gt(_, !0);
        {
          Se.ce && Se.ce._hasShadowRoot() && Se.ce._injectChildStyle(
            Ce,
            _.parent ? _.parent.type : void 0
          );
          const qe = _.subTree = $l(_);
          W(
            null,
            qe,
            k,
            R,
            _,
            M,
            C
          ), y.el = qe.el;
        }
        if (pe && Ye(pe, M), !Ze && (j = Q && Q.onVnodeMounted)) {
          const qe = y;
          Ye(
            () => gt(j, ve, qe),
            M
          );
        }
        (y.shapeFlag & 256 || ve && Cn(ve.vnode) && ve.vnode.shapeFlag & 256) && _.a && Ye(_.a, M), _.isMounted = !0, y = k = R = null;
      }
    };
    _.scope.on();
    const A = _.effect = new mo(O);
    _.scope.off();
    const E = _.update = A.run.bind(A), Y = _.job = A.runIfDirty.bind(A);
    Y.i = _, Y.id = _.uid, A.scheduler = () => ol(Y), Gt(_, !0), E();
  }, ce = (_, y, k) => {
    y.component = _;
    const R = _.vnode.props;
    _.vnode = y, _.next = null, yr(_, y.props, R, k), kr(_, y.children, k), Dt(), El(_), It();
  }, ie = (_, y, k, R, M, C, N, O, A = !1) => {
    const E = _ && _.children, Y = _ ? _.shapeFlag : 0, j = y.children, { patchFlag: H, shapeFlag: Q } = y;
    if (H > 0) {
      if (H & 128) {
        ft(
          E,
          j,
          k,
          R,
          M,
          C,
          N,
          O,
          A
        );
        return;
      } else if (H & 256) {
        st(
          E,
          j,
          k,
          R,
          M,
          C,
          N,
          O,
          A
        );
        return;
      }
    }
    Q & 8 ? (Y & 16 && Me(E, M, C), j !== E && b(k, j)) : Y & 16 ? Q & 16 ? ft(
      E,
      j,
      k,
      R,
      M,
      C,
      N,
      O,
      A
    ) : Me(E, M, C, !0) : (Y & 8 && b(k, ""), Q & 16 && Ke(
      j,
      k,
      R,
      M,
      C,
      N,
      O,
      A
    ));
  }, st = (_, y, k, R, M, C, N, O, A) => {
    _ = _ || sn, y = y || sn;
    const E = _.length, Y = y.length, j = Math.min(E, Y);
    let H;
    for (H = 0; H < j; H++) {
      const Q = y[H] = A ? Rt(y[H]) : ht(y[H]);
      W(
        _[H],
        Q,
        k,
        null,
        M,
        C,
        N,
        O,
        A
      );
    }
    E > Y ? Me(
      _,
      M,
      C,
      !0,
      !1,
      j
    ) : Ke(
      y,
      k,
      R,
      M,
      C,
      N,
      O,
      A,
      j
    );
  }, ft = (_, y, k, R, M, C, N, O, A) => {
    let E = 0;
    const Y = y.length;
    let j = _.length - 1, H = Y - 1;
    for (; E <= j && E <= H; ) {
      const Q = _[E], le = y[E] = A ? Rt(y[E]) : ht(y[E]);
      if (_n(Q, le))
        W(
          Q,
          le,
          k,
          null,
          M,
          C,
          N,
          O,
          A
        );
      else
        break;
      E++;
    }
    for (; E <= j && E <= H; ) {
      const Q = _[j], le = y[H] = A ? Rt(y[H]) : ht(y[H]);
      if (_n(Q, le))
        W(
          Q,
          le,
          k,
          null,
          M,
          C,
          N,
          O,
          A
        );
      else
        break;
      j--, H--;
    }
    if (E > j) {
      if (E <= H) {
        const Q = H + 1, le = Q < Y ? y[Q].el : R;
        for (; E <= H; )
          W(
            null,
            y[E] = A ? Rt(y[E]) : ht(y[E]),
            k,
            le,
            M,
            C,
            N,
            O,
            A
          ), E++;
      }
    } else if (E > H)
      for (; E <= j; )
        Ae(_[E], M, C, !0), E++;
    else {
      const Q = E, le = E, pe = /* @__PURE__ */ new Map();
      for (E = le; E <= H; E++) {
        const De = y[E] = A ? Rt(y[E]) : ht(y[E]);
        De.key != null && pe.set(De.key, E);
      }
      let ve, Se = 0;
      const Ce = H - le + 1;
      let Ze = !1, qe = 0;
      const Lt = new Array(Ce);
      for (E = 0; E < Ce; E++) Lt[E] = 0;
      for (E = Q; E <= j; E++) {
        const De = _[E];
        if (Se >= Ce) {
          Ae(De, M, C, !0);
          continue;
        }
        let Qe;
        if (De.key != null)
          Qe = pe.get(De.key);
        else
          for (ve = le; ve <= H; ve++)
            if (Lt[ve - le] === 0 && _n(De, y[ve])) {
              Qe = ve;
              break;
            }
        Qe === void 0 ? Ae(De, M, C, !0) : (Lt[Qe - le] = E + 1, Qe >= qe ? qe = Qe : Ze = !0, W(
          De,
          y[Qe],
          k,
          null,
          M,
          C,
          N,
          O,
          A
        ), Se++);
      }
      const fn = Ze ? Rr(Lt) : sn;
      for (ve = fn.length - 1, E = Ce - 1; E >= 0; E--) {
        const De = le + E, Qe = y[De], en = y[De + 1], jn = De + 1 < Y ? (
          // #13559, #14173 fallback to el placeholder for unresolved async component
          en.el || ii(en)
        ) : R;
        Lt[E] === 0 ? W(
          null,
          Qe,
          k,
          jn,
          M,
          C,
          N,
          O,
          A
        ) : Ze && (ve < 0 || E !== fn[ve] ? lt(Qe, k, jn, 2) : ve--);
      }
    }
  }, lt = (_, y, k, R, M = null) => {
    const { el: C, type: N, transition: O, children: A, shapeFlag: E } = _;
    if (E & 6) {
      lt(_.component.subTree, y, k, R);
      return;
    }
    if (E & 128) {
      _.suspense.move(y, k, R);
      return;
    }
    if (E & 64) {
      N.move(_, y, k, ot);
      return;
    }
    if (N === T) {
      i(C, y, k);
      for (let j = 0; j < A.length; j++)
        lt(A[j], y, k, R);
      i(_.anchor, y, k);
      return;
    }
    if (N === Ps) {
      ne(_, y, k);
      return;
    }
    if (R !== 2 && E & 1 && O)
      if (R === 0)
        O.beforeEnter(C), i(C, y, k), Ye(() => O.enter(C), M);
      else {
        const { leave: j, delayLeave: H, afterLeave: Q } = O, le = () => {
          _.ctx.isUnmounted ? a(C) : i(C, y, k);
        }, pe = () => {
          C._isLeaving && C[Ha](
            !0
            /* cancelled */
          ), j(C, () => {
            le(), Q && Q();
          });
        };
        H ? H(C, le, pe) : pe();
      }
    else
      i(C, y, k);
  }, Ae = (_, y, k, R = !1, M = !1) => {
    const {
      type: C,
      props: N,
      ref: O,
      children: A,
      dynamicChildren: E,
      shapeFlag: Y,
      patchFlag: j,
      dirs: H,
      cacheIndex: Q,
      memo: le
    } = _;
    if (j === -2 && (M = !1), O != null && (Dt(), wn(O, null, k, _, !0), It()), Q != null && (y.renderCache[Q] = void 0), Y & 256) {
      y.ctx.deactivate(_);
      return;
    }
    const pe = Y & 1 && H, ve = !Cn(_);
    let Se;
    if (ve && (Se = N && N.onVnodeBeforeUnmount) && gt(Se, y, _), Y & 6)
      Ht(_.component, k, R);
    else {
      if (Y & 128) {
        _.suspense.unmount(k, R);
        return;
      }
      pe && Yt(_, null, y, "beforeUnmount"), Y & 64 ? _.type.remove(
        _,
        y,
        k,
        ot,
        R
      ) : E && // #5154
      // when v-once is used inside a block, setBlockTracking(-1) marks the
      // parent block with hasOnce: true
      // so that it doesn't take the fast path during unmount - otherwise
      // components nested in v-once are never unmounted.
      !E.hasOnce && // #1153: fast path should not be taken for non-stable (v-for) fragments
      (C !== T || j > 0 && j & 64) ? Me(
        E,
        y,
        k,
        !1,
        !0
      ) : (C === T && j & 384 || !M && Y & 16) && Me(A, y, k), R && Nt(_);
    }
    const Ce = le != null && Q == null;
    (ve && (Se = N && N.onVnodeUnmounted) || pe || Ce) && Ye(() => {
      Se && gt(Se, y, _), pe && Yt(_, null, y, "unmounted"), Ce && (_.el = null);
    }, k);
  }, Nt = (_) => {
    const { type: y, el: k, anchor: R, transition: M } = _;
    if (y === T) {
      vt(k, R);
      return;
    }
    if (y === Ps) {
      U(_);
      return;
    }
    const C = () => {
      a(k), M && !M.persisted && M.afterLeave && M.afterLeave();
    };
    if (_.shapeFlag & 1 && M && !M.persisted) {
      const { leave: N, delayLeave: O } = M, A = () => N(k, C);
      O ? O(_.el, C, A) : A();
    } else
      C();
  }, vt = (_, y) => {
    let k;
    for (; _ !== y; )
      k = V(_), a(_), _ = k;
    a(y);
  }, Ht = (_, y, k) => {
    const { bum: R, scope: M, job: C, subTree: N, um: O, m: A, a: E } = _;
    Ll(A), Ll(E), R && qn(R), M.stop(), C && (C.flags |= 8, Ae(N, _, y, k)), O && Ye(O, y), Ye(() => {
      _.isUnmounted = !0;
    }, y);
  }, Me = (_, y, k, R = !1, M = !1, C = 0) => {
    for (let N = C; N < _.length; N++)
      Ae(_[N], y, k, R, M);
  }, Oe = (_) => {
    if (_.shapeFlag & 6)
      return Oe(_.component.subTree);
    if (_.shapeFlag & 128)
      return _.suspense.next();
    const y = V(_.anchor || _.el), k = y && y[Ua];
    return k ? V(k) : y;
  };
  let Re = !1;
  const Ge = (_, y, k) => {
    let R;
    _ == null ? y._vnode && (Ae(y._vnode, null, null, !0), R = y._vnode.component) : W(
      y._vnode || null,
      _,
      y,
      null,
      null,
      null,
      k
    ), y._vnode = _, Re || (Re = !0, El(R), Vo(), Re = !1);
  }, ot = {
    p: W,
    um: Ae,
    m: lt,
    r: Nt,
    mt: B,
    mc: Ke,
    pc: ie,
    pbc: K,
    n: Oe,
    o: e
  };
  return {
    render: Ge,
    hydrate: void 0,
    createApp: ur(Ge)
  };
}
function Es({ type: e, props: t }, s) {
  return s === "svg" && e === "foreignObject" || s === "mathml" && e === "annotation-xml" && t && t.encoding && t.encoding.includes("html") ? void 0 : s;
}
function Gt({ effect: e, job: t }, s) {
  s ? (e.flags |= 32, t.flags |= 4) : (e.flags &= -33, t.flags &= -5);
}
function Mr(e, t) {
  return (!e || e && !e.pendingBranch) && t && !t.persisted;
}
function li(e, t, s = !1) {
  const i = e.children, a = t.children;
  if (X(i) && X(a))
    for (let u = 0; u < i.length; u++) {
      const d = i[u];
      let p = a[u];
      p.shapeFlag & 1 && !p.dynamicChildren && ((p.patchFlag <= 0 || p.patchFlag === 32) && (p = a[u] = Rt(a[u]), p.el = d.el), !s && p.patchFlag !== -2 && li(d, p)), p.type === ds && (p.patchFlag === -1 && (p = a[u] = Rt(p)), p.el = d.el), p.type === Ut && !p.el && (p.el = d.el);
    }
}
function Rr(e) {
  const t = e.slice(), s = [0];
  let i, a, u, d, p;
  const g = e.length;
  for (i = 0; i < g; i++) {
    const S = e[i];
    if (S !== 0) {
      if (a = s[s.length - 1], e[a] < S) {
        t[i] = a, s.push(i);
        continue;
      }
      for (u = 0, d = s.length - 1; u < d; )
        p = u + d >> 1, e[s[p]] < S ? u = p + 1 : d = p;
      S < e[s[u]] && (u > 0 && (t[i] = s[u - 1]), s[u] = i);
    }
  }
  for (u = s.length, d = s[u - 1]; u-- > 0; )
    s[u] = d, d = t[d];
  return s;
}
function oi(e) {
  const t = e.subTree.component;
  if (t)
    return t.asyncDep && !t.asyncResolved ? t : oi(t);
}
function Ll(e) {
  if (e)
    for (let t = 0; t < e.length; t++)
      e[t].flags |= 8;
}
function ii(e) {
  if (e.placeholder)
    return e.placeholder;
  const t = e.component;
  return t ? ii(t.subTree) : null;
}
const ai = (e) => e.__isSuspense;
function Tr(e, t) {
  t && t.pendingBranch ? X(e) ? t.effects.push(...e) : t.effects.push(e) : Fa(e);
}
const T = /* @__PURE__ */ Symbol.for("v-fgt"), ds = /* @__PURE__ */ Symbol.for("v-txt"), Ut = /* @__PURE__ */ Symbol.for("v-cmt"), Ps = /* @__PURE__ */ Symbol.for("v-stc"), Rn = [];
let Je = null;
function f(e = !1) {
  Rn.push(Je = e ? null : []);
}
function Er() {
  Rn.pop(), Je = Rn[Rn.length - 1] || null;
}
let In = 1;
function jl(e, t = !1) {
  In += e, e < 0 && Je && t && (Je.hasOnce = !0);
}
function ri(e) {
  return e.dynamicChildren = In > 0 ? Je || sn : null, Er(), In > 0 && Je && Je.push(e), e;
}
function v(e, t, s, i, a, u) {
  return ri(
    n(
      e,
      t,
      s,
      i,
      a,
      u,
      !0
    )
  );
}
function Pr(e, t, s, i, a) {
  return ri(
    Pt(
      e,
      t,
      s,
      i,
      a,
      !0
    )
  );
}
function ci(e) {
  return e ? e.__v_isVNode === !0 : !1;
}
function _n(e, t) {
  return e.type === t.type && e.key === t.key;
}
const ui = ({ key: e }) => e ?? null, Yn = ({
  ref: e,
  ref_key: t,
  ref_for: s
}) => (typeof e == "number" && (e = "" + e), e != null ? ke(e) || /* @__PURE__ */ Ne(e) || ee(e) ? { i: tt, r: e, k: t, f: !!s } : e : null);
function n(e, t = null, s = null, i = 0, a = null, u = e === T ? 0 : 1, d = !1, p = !1) {
  const g = {
    __v_isVNode: !0,
    __v_skip: !0,
    type: e,
    props: t,
    key: t && ui(t),
    ref: t && Yn(t),
    scopeId: $o,
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
    shapeFlag: u,
    patchFlag: i,
    dynamicProps: a,
    dynamicChildren: null,
    appContext: null,
    ctx: tt
  };
  return p ? (cl(g, s), u & 128 && e.normalize(g)) : s && (g.shapeFlag |= ke(s) ? 8 : 16), In > 0 && // avoid a block node from tracking itself
  !d && // has current parent block
  Je && // presence of a patch flag indicates this node needs patching on updates.
  // component nodes also should always be patched, because even if the
  // component doesn't need to update, it needs to persist the instance on to
  // the next vnode so that it can be properly unmounted later.
  (g.patchFlag > 0 || u & 6) && // the EVENTS flag is only for hydration and if it is the only flag, the
  // vnode should not be considered dynamic due to handler caching.
  g.patchFlag !== 32 && Je.push(g), g;
}
const Pt = Ar;
function Ar(e, t = null, s = null, i = 0, a = null, u = !1) {
  if ((!e || e === nr) && (e = Ut), ci(e)) {
    const p = cn(
      e,
      t,
      !0
      /* mergeRef: true */
    );
    return s && cl(p, s), In > 0 && !u && Je && (p.shapeFlag & 6 ? Je[Je.indexOf(e)] = p : Je.push(p)), p.patchFlag = -2, p;
  }
  if (Wr(e) && (e = e.__vccOpts), t) {
    t = Dr(t);
    let { class: p, style: g } = t;
    p && !ke(p) && (t.class = $(p)), ge(g) && (/* @__PURE__ */ ll(g) && !X(g) && (g = Le({}, g)), t.style = rt(g));
  }
  const d = ke(e) ? 1 : ai(e) ? 128 : Ka(e) ? 64 : ge(e) ? 4 : ee(e) ? 2 : 0;
  return n(
    e,
    t,
    s,
    i,
    a,
    d,
    u,
    !0
  );
}
function Dr(e) {
  return e ? /* @__PURE__ */ ll(e) || Jo(e) ? Le({}, e) : e : null;
}
function cn(e, t, s = !1, i = !1) {
  const { props: a, ref: u, patchFlag: d, children: p, transition: g } = e, S = t ? Ir(a || {}, t) : a, b = {
    __v_isVNode: !0,
    __v_skip: !0,
    type: e.type,
    props: S,
    key: S && ui(S),
    ref: t && t.ref ? (
      // #2078 in the case of <component :is="vnode" ref="extra"/>
      // if the vnode itself already has a ref, cloneVNode will need to merge
      // the refs so the single vnode can be set on multiple refs
      s && u ? X(u) ? u.concat(Yn(t)) : [u, Yn(t)] : Yn(t)
    ) : u,
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
    patchFlag: t && e.type !== T ? d === -1 ? 16 : d | 16 : d,
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
    ssContent: e.ssContent && cn(e.ssContent),
    ssFallback: e.ssFallback && cn(e.ssFallback),
    placeholder: e.placeholder,
    el: e.el,
    anchor: e.anchor,
    ctx: e.ctx,
    ce: e.ce
  };
  return g && i && il(
    b,
    g.clone(b)
  ), b;
}
function et(e = " ", t = 0) {
  return Pt(ds, null, e, t);
}
function q(e = "", t = !1) {
  return t ? (f(), Pr(Ut, null, e)) : Pt(Ut, null, e);
}
function ht(e) {
  return e == null || typeof e == "boolean" ? Pt(Ut) : X(e) ? Pt(
    T,
    null,
    // #3666, avoid reference pollution when reusing vnode
    e.slice()
  ) : ci(e) ? Rt(e) : Pt(ds, null, String(e));
}
function Rt(e) {
  return e.el === null && e.patchFlag !== -1 || e.memo ? e : cn(e);
}
function cl(e, t) {
  let s = 0;
  const { shapeFlag: i } = e;
  if (t == null)
    t = null;
  else if (X(t))
    s = 16;
  else if (typeof t == "object")
    if (i & 65) {
      const a = t.default;
      a && (a._c && (a._d = !1), cl(e, a()), a._c && (a._d = !0));
      return;
    } else {
      s = 32;
      const a = t._;
      !a && !Jo(t) ? t._ctx = tt : a === 3 && tt && (tt.slots._ === 1 ? t._ = 1 : (t._ = 2, e.patchFlag |= 1024));
    }
  else ee(t) ? (t = { default: t, _ctx: tt }, s = 32) : (t = String(t), i & 64 ? (s = 16, t = [et(t)]) : s = 8);
  e.children = t, e.shapeFlag |= s;
}
function Ir(...e) {
  const t = {};
  for (let s = 0; s < e.length; s++) {
    const i = e[s];
    for (const a in i)
      if (a === "class")
        t.class !== i.class && (t.class = $([t.class, i.class]));
      else if (a === "style")
        t.style = rt([t.style, i.style]);
      else if (ns(a)) {
        const u = t[a], d = i[a];
        d && u !== d && !(X(u) && u.includes(d)) ? t[a] = u ? [].concat(u, d) : d : d == null && u == null && // mergeProps({ 'onUpdate:modelValue': undefined }) should not retain
        // the model listener.
        !ss(a) && (t[a] = d);
      } else a !== "" && (t[a] = i[a]);
  }
  return t;
}
function gt(e, t, s, i = null) {
  St(e, t, 7, [
    s,
    i
  ]);
}
const Vr = zo();
let Or = 0;
function $r(e, t, s) {
  const i = e.type, a = (t ? t.appContext : e.appContext) || Vr, u = {
    uid: Or++,
    vnode: e,
    type: i,
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
    scope: new oa(
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
    propsOptions: ei(i, a),
    emitsOptions: Yo(i, a),
    // emit
    emit: null,
    // to be set immediately
    emitted: null,
    // props default value
    propsDefaults: _e,
    // inheritAttrs
    inheritAttrs: i.inheritAttrs,
    // state
    ctx: _e,
    data: _e,
    props: _e,
    attrs: _e,
    slots: _e,
    refs: _e,
    setupState: _e,
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
  return u.ctx = { _: u }, u.root = t ? t.root : u, u.emit = pr.bind(null, u), e.ce && e.ce(u), u;
}
let Ue = null;
const Fr = () => Ue || tt;
let ts, Us;
{
  const e = is(), t = (s, i) => {
    let a;
    return (a = e[s]) || (a = e[s] = []), a.push(i), (u) => {
      a.length > 1 ? a.forEach((d) => d(u)) : a[0](u);
    };
  };
  ts = t(
    "__VUE_INSTANCE_SETTERS__",
    (s) => Ue = s
  ), Us = t(
    "__VUE_SSR_SETTERS__",
    (s) => Vn = s
  );
}
const Nn = (e) => {
  const t = Ue;
  return ts(e), e.scope.on(), () => {
    e.scope.off(), ts(t);
  };
}, Bl = () => {
  Ue && Ue.scope.off(), ts(null);
};
function di(e) {
  return e.vnode.shapeFlag & 4;
}
let Vn = !1;
function Nr(e, t = !1, s = !1) {
  t && Us(t);
  const { props: i, children: a } = e.vnode, u = di(e);
  hr(e, i, u, t), Sr(e, a, s || t);
  const d = u ? Lr(e, t) : void 0;
  return t && Us(!1), d;
}
function Lr(e, t) {
  const s = e.type;
  e.accessCache = /* @__PURE__ */ Object.create(null), e.proxy = new Proxy(e.ctx, sr);
  const { setup: i } = s;
  if (i) {
    Dt();
    const a = e.setupContext = i.length > 1 ? Br(e) : null, u = Nn(e), d = Fn(
      i,
      e,
      0,
      [
        e.props,
        a
      ]
    ), p = ao(d);
    if (It(), u(), (p || e.sp) && !Cn(e) && Lo(e), p) {
      if (d.then(Bl, Bl), t)
        return d.then((g) => {
          Wl(e, g);
        }).catch((g) => {
          rs(g, e, 0);
        });
      e.asyncDep = d;
    } else
      Wl(e, d);
  } else
    pi(e);
}
function Wl(e, t, s) {
  ee(t) ? e.type.__ssrInlineRender ? e.ssrRender = t : e.render = t : ge(t) && (e.setupState = Po(t)), pi(e);
}
function pi(e, t, s) {
  const i = e.type;
  e.render || (e.render = i.render || bt);
  {
    const a = Nn(e);
    Dt();
    try {
      lr(e);
    } finally {
      It(), a();
    }
  }
}
const jr = {
  get(e, t) {
    return Fe(e, "get", ""), e[t];
  }
};
function Br(e) {
  const t = (s) => {
    e.exposed = s || {};
  };
  return {
    attrs: new Proxy(e.attrs, jr),
    slots: e.slots,
    emit: e.emit,
    expose: t
  };
}
function ps(e) {
  return e.exposed ? e.exposeProxy || (e.exposeProxy = new Proxy(Po(Ma(e.exposed)), {
    get(t, s) {
      if (s in t)
        return t[s];
      if (s in Mn)
        return Mn[s](e);
    },
    has(t, s) {
      return s in t || s in Mn;
    }
  })) : e.proxy;
}
function Wr(e) {
  return ee(e) && "__vccOpts" in e;
}
const fe = (e, t) => /* @__PURE__ */ Da(e, t, Vn), Ur = "3.5.34";
let Ks;
const Ul = typeof window < "u" && window.trustedTypes;
if (Ul)
  try {
    Ks = /* @__PURE__ */ Ul.createPolicy("vue", {
      createHTML: (e) => e
    });
  } catch {
  }
const fi = Ks ? (e) => Ks.createHTML(e) : (e) => e, Kr = "http://www.w3.org/2000/svg", Hr = "http://www.w3.org/1998/Math/MathML", Mt = typeof document < "u" ? document : null, Kl = Mt && /* @__PURE__ */ Mt.createElement("template"), qr = {
  insert: (e, t, s) => {
    t.insertBefore(e, s || null);
  },
  remove: (e) => {
    const t = e.parentNode;
    t && t.removeChild(e);
  },
  createElement: (e, t, s, i) => {
    const a = t === "svg" ? Mt.createElementNS(Kr, e) : t === "mathml" ? Mt.createElementNS(Hr, e) : s ? Mt.createElement(e, { is: s }) : Mt.createElement(e);
    return e === "select" && i && i.multiple != null && a.setAttribute("multiple", i.multiple), a;
  },
  createText: (e) => Mt.createTextNode(e),
  createComment: (e) => Mt.createComment(e),
  setText: (e, t) => {
    e.nodeValue = t;
  },
  setElementText: (e, t) => {
    e.textContent = t;
  },
  parentNode: (e) => e.parentNode,
  nextSibling: (e) => e.nextSibling,
  querySelector: (e) => Mt.querySelector(e),
  setScopeId(e, t) {
    e.setAttribute(t, "");
  },
  // __UNSAFE__
  // Reason: innerHTML.
  // Static content here can only come from compiled templates.
  // As long as the user only uses trusted templates, this is safe.
  insertStaticContent(e, t, s, i, a, u) {
    const d = s ? s.previousSibling : t.lastChild;
    if (a && (a === u || a.nextSibling))
      for (; t.insertBefore(a.cloneNode(!0), s), !(a === u || !(a = a.nextSibling)); )
        ;
    else {
      Kl.innerHTML = fi(
        i === "svg" ? `<svg>${e}</svg>` : i === "mathml" ? `<math>${e}</math>` : e
      );
      const p = Kl.content;
      if (i === "svg" || i === "mathml") {
        const g = p.firstChild;
        for (; g.firstChild; )
          p.appendChild(g.firstChild);
        p.removeChild(g);
      }
      t.insertBefore(p, s);
    }
    return [
      // first
      d ? d.nextSibling : t.firstChild,
      // last
      s ? s.previousSibling : t.lastChild
    ];
  }
}, zr = /* @__PURE__ */ Symbol("_vtc");
function Yr(e, t, s) {
  const i = e[zr];
  i && (t = (t ? [t, ...i] : [...i]).join(" ")), t == null ? e.removeAttribute("class") : s ? e.setAttribute("class", t) : e.className = t;
}
const Hl = /* @__PURE__ */ Symbol("_vod"), Gr = /* @__PURE__ */ Symbol("_vsh"), Qr = /* @__PURE__ */ Symbol(""), Xr = /(?:^|;)\s*display\s*:/;
function Jr(e, t, s) {
  const i = e.style, a = ke(s);
  let u = !1;
  if (s && !a) {
    if (t)
      if (ke(t))
        for (const d of t.split(";")) {
          const p = d.slice(0, d.indexOf(":")).trim();
          s[p] == null && yn(i, p, "");
        }
      else
        for (const d in t)
          s[d] == null && yn(i, d, "");
    for (const d in s) {
      d === "display" && (u = !0);
      const p = s[d];
      p != null ? ec(
        e,
        d,
        !ke(t) && t ? t[d] : void 0,
        p
      ) || yn(i, d, p) : yn(i, d, "");
    }
  } else if (a) {
    if (t !== s) {
      const d = i[Qr];
      d && (s += ";" + d), i.cssText = s, u = Xr.test(s);
    }
  } else t && e.removeAttribute("style");
  Hl in e && (e[Hl] = u ? i.display : "", e[Gr] && (i.display = "none"));
}
const ql = /\s*!important$/;
function yn(e, t, s) {
  if (X(s))
    s.forEach((i) => yn(e, t, i));
  else if (s == null && (s = ""), t.startsWith("--"))
    e.setProperty(t, s);
  else {
    const i = Zr(e, t);
    ql.test(s) ? e.setProperty(
      Kt(i),
      s.replace(ql, ""),
      "important"
    ) : e[i] = s;
  }
}
const zl = ["Webkit", "Moz", "ms"], As = {};
function Zr(e, t) {
  const s = As[t];
  if (s)
    return s;
  let i = ct(t);
  if (i !== "filter" && i in e)
    return As[t] = i;
  i = uo(i);
  for (let a = 0; a < zl.length; a++) {
    const u = zl[a] + i;
    if (u in e)
      return As[t] = u;
  }
  return t;
}
function ec(e, t, s, i) {
  return e.tagName === "TEXTAREA" && (t === "width" || t === "height") && ke(i) && s === i;
}
const Yl = "http://www.w3.org/1999/xlink";
function Gl(e, t, s, i, a, u = sa(t)) {
  i && t.startsWith("xlink:") ? s == null ? e.removeAttributeNS(Yl, t.slice(6, t.length)) : e.setAttributeNS(Yl, t, s) : s == null || u && !fo(s) ? e.removeAttribute(t) : e.setAttribute(
    t,
    u ? "" : xt(s) ? String(s) : s
  );
}
function Ql(e, t, s, i, a) {
  if (t === "innerHTML" || t === "textContent") {
    s != null && (e[t] = t === "innerHTML" ? fi(s) : s);
    return;
  }
  const u = e.tagName;
  if (t === "value" && u !== "PROGRESS" && // custom elements may use _value internally
  !u.includes("-")) {
    const p = u === "OPTION" ? e.getAttribute("value") || "" : e.value, g = s == null ? (
      // #11647: value should be set as empty string for null and undefined,
      // but <input type="checkbox"> should be set as 'on'.
      e.type === "checkbox" ? "on" : ""
    ) : String(s);
    (p !== g || !("_value" in e)) && (e.value = g), s == null && e.removeAttribute(t), e._value = s;
    return;
  }
  let d = !1;
  if (s === "" || s == null) {
    const p = typeof e[t];
    p === "boolean" ? s = fo(s) : s == null && p === "string" ? (s = "", d = !0) : p === "number" && (s = 0, d = !0);
  }
  try {
    e[t] = s;
  } catch {
  }
  d && e.removeAttribute(a || t);
}
function Bt(e, t, s, i) {
  e.addEventListener(t, s, i);
}
function tc(e, t, s, i) {
  e.removeEventListener(t, s, i);
}
const Xl = /* @__PURE__ */ Symbol("_vei");
function nc(e, t, s, i, a = null) {
  const u = e[Xl] || (e[Xl] = {}), d = u[t];
  if (i && d)
    d.value = i;
  else {
    const [p, g] = sc(t);
    if (i) {
      const S = u[t] = ic(
        i,
        a
      );
      Bt(e, p, S, g);
    } else d && (tc(e, p, d, g), u[t] = void 0);
  }
}
const Jl = /(?:Once|Passive|Capture)$/;
function sc(e) {
  let t;
  if (Jl.test(e)) {
    t = {};
    let i;
    for (; i = e.match(Jl); )
      e = e.slice(0, e.length - i[0].length), t[i[0].toLowerCase()] = !0;
  }
  return [e[2] === ":" ? e.slice(3) : Kt(e.slice(2)), t];
}
let Ds = 0;
const lc = /* @__PURE__ */ Promise.resolve(), oc = () => Ds || (lc.then(() => Ds = 0), Ds = Date.now());
function ic(e, t) {
  const s = (i) => {
    if (!i._vts)
      i._vts = Date.now();
    else if (i._vts <= s.attached)
      return;
    St(
      ac(i, s.value),
      t,
      5,
      [i]
    );
  };
  return s.value = e, s.attached = oc(), s;
}
function ac(e, t) {
  if (X(t)) {
    const s = e.stopImmediatePropagation;
    return e.stopImmediatePropagation = () => {
      s.call(e), e._stopped = !0;
    }, t.map(
      (i) => (a) => !a._stopped && i && i(a)
    );
  } else
    return t;
}
const Zl = (e) => e.charCodeAt(0) === 111 && e.charCodeAt(1) === 110 && // lowercase letter
e.charCodeAt(2) > 96 && e.charCodeAt(2) < 123, rc = (e, t, s, i, a, u) => {
  const d = a === "svg";
  t === "class" ? Yr(e, i, d) : t === "style" ? Jr(e, s, i) : ns(t) ? ss(t) || nc(e, t, s, i, u) : (t[0] === "." ? (t = t.slice(1), !0) : t[0] === "^" ? (t = t.slice(1), !1) : cc(e, t, i, d)) ? (Ql(e, t, i), !e.tagName.includes("-") && (t === "value" || t === "checked" || t === "selected") && Gl(e, t, i, d, u, t !== "value")) : /* #11081 force set props for possible async custom element */ e._isVueCE && // #12408 check if it's declared prop or it's async custom element
  (uc(e, t) || // @ts-expect-error _def is private
  e._def.__asyncLoader && (/[A-Z]/.test(t) || !ke(i))) ? Ql(e, ct(t), i, u, t) : (t === "true-value" ? e._trueValue = i : t === "false-value" && (e._falseValue = i), Gl(e, t, i, d));
};
function cc(e, t, s, i) {
  if (i)
    return !!(t === "innerHTML" || t === "textContent" || t in e && Zl(t) && ee(s));
  if (t === "spellcheck" || t === "draggable" || t === "translate" || t === "autocorrect" || t === "sandbox" && e.tagName === "IFRAME" || t === "form" || t === "list" && e.tagName === "INPUT" || t === "type" && e.tagName === "TEXTAREA")
    return !1;
  if (t === "width" || t === "height") {
    const a = e.tagName;
    if (a === "IMG" || a === "VIDEO" || a === "CANVAS" || a === "SOURCE")
      return !1;
  }
  return Zl(t) && ke(s) ? !1 : t in e;
}
function uc(e, t) {
  const s = (
    // @ts-expect-error _def is private
    e._def.props
  );
  if (!s)
    return !1;
  const i = ct(t);
  return Array.isArray(s) ? s.some((a) => ct(a) === i) : Object.keys(s).some((a) => ct(a) === i);
}
const un = (e) => {
  const t = e.props["onUpdate:modelValue"] || !1;
  return X(t) ? (s) => qn(t, s) : t;
};
function dc(e) {
  e.target.composing = !0;
}
function eo(e) {
  const t = e.target;
  t.composing && (t.composing = !1, t.dispatchEvent(new Event("input")));
}
const At = /* @__PURE__ */ Symbol("_assign");
function to(e, t, s) {
  return t && (e = e.trim()), s && (e = os(e)), e;
}
const je = {
  created(e, { modifiers: { lazy: t, trim: s, number: i } }, a) {
    e[At] = un(a);
    const u = i || a.props && a.props.type === "number";
    Bt(e, t ? "change" : "input", (d) => {
      d.target.composing || e[At](to(e.value, s, u));
    }), (s || u) && Bt(e, "change", () => {
      e.value = to(e.value, s, u);
    }), t || (Bt(e, "compositionstart", dc), Bt(e, "compositionend", eo), Bt(e, "change", eo));
  },
  // set value on mounted so it's after min/max for type="range"
  mounted(e, { value: t }) {
    e.value = t ?? "";
  },
  beforeUpdate(e, { value: t, oldValue: s, modifiers: { lazy: i, trim: a, number: u } }, d) {
    if (e[At] = un(d), e.composing) return;
    const p = (u || e.type === "number") && !/^0\d/.test(e.value) ? os(e.value) : e.value, g = t ?? "";
    if (p === g)
      return;
    const S = e.getRootNode();
    (S instanceof Document || S instanceof ShadowRoot) && S.activeElement === e && e.type !== "range" && (i && t === s || a && e.value.trim() === g) || (e.value = g);
  }
}, no = {
  // #4096 array checkboxes need to be deep traversed
  deep: !0,
  created(e, t, s) {
    e[At] = un(s), Bt(e, "change", () => {
      const i = e._modelValue, a = On(e), u = e.checked, d = e[At];
      if (X(i)) {
        const p = Qs(i, a), g = p !== -1;
        if (u && !g)
          d(i.concat(a));
        else if (!u && g) {
          const S = [...i];
          S.splice(p, 1), d(S);
        }
      } else if (dn(i)) {
        const p = new Set(i);
        u ? p.add(a) : p.delete(a), d(p);
      } else
        d(vi(e, u));
    });
  },
  // set initial checked on mount to wait for true-value/false-value
  mounted: so,
  beforeUpdate(e, t, s) {
    e[At] = un(s), so(e, t, s);
  }
};
function so(e, { value: t, oldValue: s }, i) {
  e._modelValue = t;
  let a;
  if (X(t))
    a = Qs(t, i.props.value) > -1;
  else if (dn(t))
    a = t.has(i.props.value);
  else {
    if (t === s) return;
    a = pn(t, vi(e, !0));
  }
  e.checked !== a && (e.checked = a);
}
const pc = {
  // <select multiple> value need to be deep traversed
  deep: !0,
  created(e, { value: t, modifiers: { number: s } }, i) {
    const a = dn(t);
    Bt(e, "change", () => {
      const u = Array.prototype.filter.call(e.options, (d) => d.selected).map(
        (d) => s ? os(On(d)) : On(d)
      );
      e[At](
        e.multiple ? a ? new Set(u) : u : u[0]
      ), e._assigning = !0, Do(() => {
        e._assigning = !1;
      });
    }), e[At] = un(i);
  },
  // set value in mounted & updated because <select> relies on its children
  // <option>s.
  mounted(e, { value: t }) {
    lo(e, t);
  },
  beforeUpdate(e, t, s) {
    e[At] = un(s);
  },
  updated(e, { value: t }) {
    e._assigning || lo(e, t);
  }
};
function lo(e, t) {
  const s = e.multiple, i = X(t);
  if (!(s && !i && !dn(t))) {
    for (let a = 0, u = e.options.length; a < u; a++) {
      const d = e.options[a], p = On(d);
      if (s)
        if (i) {
          const g = typeof p;
          g === "string" || g === "number" ? d.selected = t.some((S) => String(S) === String(p)) : d.selected = Qs(t, p) > -1;
        } else
          d.selected = t.has(p);
      else if (pn(On(d), t)) {
        e.selectedIndex !== a && (e.selectedIndex = a);
        return;
      }
    }
    !s && e.selectedIndex !== -1 && (e.selectedIndex = -1);
  }
}
function On(e) {
  return "_value" in e ? e._value : e.value;
}
function vi(e, t) {
  const s = t ? "_trueValue" : "_falseValue";
  return s in e ? e[s] : t;
}
const fc = ["ctrl", "shift", "alt", "meta"], vc = {
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
  exact: (e, t) => fc.some((s) => e[`${s}Key`] && !t.includes(s))
}, gc = (e, t) => {
  if (!e) return e;
  const s = e._withMods || (e._withMods = {}), i = t.join(".");
  return s[i] || (s[i] = ((a, ...u) => {
    for (let d = 0; d < t.length; d++) {
      const p = vc[t[d]];
      if (p && p(a, t)) return;
    }
    return e(a, ...u);
  }));
}, mc = {
  esc: "escape",
  space: " ",
  up: "arrow-up",
  left: "arrow-left",
  right: "arrow-right",
  down: "arrow-down",
  delete: "backspace"
}, _c = (e, t) => {
  const s = e._withKeys || (e._withKeys = {}), i = t.join(".");
  return s[i] || (s[i] = ((a) => {
    if (!("key" in a))
      return;
    const u = Kt(a.key);
    if (t.some(
      (d) => d === u || mc[d] === u
    ))
      return e(a);
  }));
}, hc = /* @__PURE__ */ Le({ patchProp: rc }, qr);
let oo;
function yc() {
  return oo || (oo = wr(hc));
}
const bc = ((...e) => {
  const t = yc().createApp(...e), { mount: s } = t;
  return t.mount = (i) => {
    const a = Sc(i);
    if (!a) return;
    const u = t._component;
    !ee(u) && !u.render && !u.template && (u.template = a.innerHTML), a.nodeType === 1 && (a.textContent = "");
    const d = s(a, !1, xc(a));
    return a instanceof Element && (a.removeAttribute("v-cloak"), a.setAttribute("data-v-app", "")), d;
  }, t;
});
function xc(e) {
  if (e instanceof SVGElement)
    return "svg";
  if (typeof MathMLElement == "function" && e instanceof MathMLElement)
    return "mathml";
}
function Sc(e) {
  return ke(e) ? document.querySelector(e) : e;
}
function J() {
  return typeof window < "u" && window.openxnetApp || null;
}
const xe = {
  snapshot: null,
  loading: !1,
  request: null,
  error: null,
  progress: {},
  unsubscribe: null
}, z = {
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
}, kc = [
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
function kt() {
  return typeof window < "u" && window.openxnetDesktop || null;
}
function wc() {
  const e = kt();
  xe.unsubscribe || !e?.onFeaturePackProgress || (xe.unsubscribe = e.onFeaturePackProgress((t) => {
    t?.capabilityId && (xe.progress = {
      ...xe.progress,
      [t.capabilityId]: { ...t }
    }, t.phase === "failed" && t.error && (xe.error = { ...t.error }));
  }));
}
async function fs(e = !0) {
  const t = kt();
  return t?.listFeaturePacks ? (wc(), xe.request || (xe.loading = !0, xe.request = t.listFeaturePacks({ refresh: !!e }).then((s) => (xe.snapshot = s, xe.error = s?.error || null, s)).catch((s) => (xe.error = {
    code: "FEATURE_PACK_OPERATION_FAILED",
    message: String(s?.message || "Feature Pack state could not be loaded."),
    retryable: !0
  }, null)).finally(() => {
    xe.loading = !1, xe.request = null;
  })), xe.request) : null;
}
async function Cc(e, t) {
  const s = kt(), a = {
    install: s?.installFeaturePack,
    repair: s?.repairFeaturePack,
    uninstall: s?.uninstallFeaturePack
  }[e];
  if (typeof a != "function") return null;
  xe.error = null, xe.progress = {
    ...xe.progress,
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
    return await a.call(s, { capabilityId: t });
  } catch (u) {
    throw xe.error = {
      code: "FEATURE_PACK_OPERATION_FAILED",
      message: String(u?.message || "Feature Pack operation failed."),
      retryable: !0
    }, u;
  } finally {
    await fs(!1);
  }
}
function Mc(e) {
  const t = xe.snapshot, s = new Map((t?.packs || []).map((i) => [i.capabilityId, i]));
  return {
    available: !!kt()?.listFeaturePacks,
    loading: xe.loading,
    feedStatus: t?.feedStatus || (kt() ? "loading" : "unavailable"),
    catalogGeneratedAt: t?.catalogGeneratedAt || null,
    error: xe.error || t?.error || null,
    items: kc.map((i) => {
      const a = s.get(i.capabilityId) || {};
      return {
        ...a,
        capabilityId: i.capabilityId,
        icon: i.icon,
        displayName: e ? i.nameZh : i.nameEn,
        description: e ? i.descriptionZh : i.descriptionEn,
        status: a.status || "not-installed",
        installedVersion: a.installedVersion || null,
        availableVersion: a.availableVersion || null,
        operation: a.operation || null,
        progress: xe.progress[i.capabilityId] || null
      };
    })
  };
}
function vs(e) {
  if (e && typeof e.isCurrentLanguageZh == "function")
    try {
      return !!e.isCurrentLanguageZh();
    } catch {
      return !0;
    }
  return String(e?.currentLanguage || navigator.language || "zh-CN").toLowerCase().startsWith("zh");
}
function ul(e, t, s) {
  if (!t) return "";
  if (s && t.prototypeLabelZh) return String(t.prototypeLabelZh);
  if (!s && t.prototypeLabelEn) return String(t.prototypeLabelEn);
  if (e && typeof e.t == "function" && t.title)
    try {
      return String(e.t(t.title) || t.id || "");
    } catch {
      return String(t.id || "");
    }
  return String(t.title || t.label || t.id || "");
}
function I(e) {
  return Array.isArray(e) ? e : [];
}
function Wt(e, t = 140) {
  const s = String(e || "").trim();
  return s.length <= t ? s : `${s.slice(0, t - 1)}...`;
}
function Tn(e) {
  if (!e) return "";
  try {
    const t = new Date(e);
    return Number.isNaN(t.getTime()) ? String(e) : t.toLocaleString();
  } catch {
    return String(e);
  }
}
function Ln(e) {
  return I(e).map((t) => ({
    label: String(t?.label || ""),
    value: String(t?.value ?? ""),
    meta: String(t?.meta || ""),
    emphasis: !!t?.emphasis,
    truncate: !!t?.truncate
  }));
}
function at(e, t) {
  return e ? t ? "已启用" : "Enabled" : t ? "未启用" : "Disabled";
}
function Ct(e, t, s = "运行中", i = "Running") {
  return e ? t ? s : i : t ? "待启动" : "Standby";
}
function Rc(e) {
  return e ? "true" : "false";
}
function gi(e, t, s = "") {
  const i = String(t || "").trim();
  if (!i) return String(s || "");
  if (e && typeof e.t == "function")
    try {
      const a = e.t(i);
      if (a && a !== i)
        return String(a);
    } catch {
    }
  return String(s || i);
}
function Is(e, t, s = "") {
  if (typeof t == "string")
    return { value: t, label: s || t };
  const i = String(t?.value ?? t?.id ?? t?.key ?? "").trim(), a = t?.label ?? t?.name ?? t?.title ?? i;
  return {
    value: i,
    label: gi(e, a, s || a || i),
    description: String(t?.description || t?.desc || ""),
    icon: String(t?.icon || "")
  };
}
function Tc(e) {
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
function Ec(e, t) {
  const s = I(e?.deployTiles).map((u) => ({
    id: String(u?.id || ""),
    icon: String(u?.icon || "fa-solid fa-circle"),
    label: ul(e, u, t)
  })), i = String(e?.subMenu || s[0]?.id || "table_pet"), a = e?.getPrototypeDeployDetailMeta?.(i) || {
    title: t ? "部署机器人" : "Deploy Bots",
    summary: t ? "配置多平台机器人连接、权限和消息路由。" : "Configure multi-platform bot connections, permissions, and message routing.",
    chips: []
  };
  return {
    title: t ? "部署机器人" : "Deploy Bots",
    subtitle: t ? "配置多平台机器人连接、权限和消息路由" : "Configure multi-platform bot connections, permissions, and message routing.",
    tabs: s,
    activeTab: i,
    meta: a,
    stats: Ln(e?.getPrototypeDeployDetailStats?.(i)),
    deskPet: {
      online: !!(e?.isVRMRunning || e?.vrmOnline),
      status: Ct(!!(e?.isVRMRunning || e?.vrmOnline), t, "桌宠在线", "Online"),
      modelId: String(e?.VRMConfig?.selectedModelId || e?.VRMConfig?.name || (t ? "未选择模型" : "No model")),
      expressions: at(!!e?.VRMConfig?.enabledExpressions, t),
      motions: at(!!e?.VRMConfig?.enabledMotions, t),
      width: Number(e?.VRMConfig?.windowWidth || 540),
      height: Number(e?.VRMConfig?.windowHeight || 960),
      userModels: I(e?.VRMConfig?.userModels).length,
      motionCount: I(e?.VRMConfig?.selectedMotionIds).length
    },
    imChannels: [
      {
        id: "qq",
        label: "QQ",
        running: !!e?.isQQBotRunning,
        status: Ct(!!e?.isQQBotRunning, t),
        agent: String(e?.qqBotConfig?.QQAgent || "openxnet-model"),
        memory: `${Number(e?.qqBotConfig?.memoryLimit || 30)} ${t ? "轮记忆" : "turns"}`,
        note: `${I(e?.qqBotConfig?.separators).length} ${t ? "个分隔符" : "separators"}`
      },
      {
        id: "feishu",
        label: t ? "飞书" : "Feishu",
        running: !!e?.isFeishuBotRunning,
        status: Ct(!!e?.isFeishuBotRunning, t),
        agent: String(e?.feishuBotConfig?.FeishuAgent || "openxnet-model"),
        memory: `${Number(e?.feishuBotConfig?.memoryLimit || 30)} ${t ? "轮记忆" : "turns"}`,
        note: at(!!e?.feishuBotConfig?.enableTTS, t)
      },
      {
        id: "dingtalk",
        label: t ? "钉钉" : "DingTalk",
        running: !!e?.isDingtalkBotRunning,
        status: Ct(!!e?.isDingtalkBotRunning, t),
        agent: String(e?.dingtalkBotConfig?.DingtalkAgent || "openxnet-model"),
        memory: `${Number(e?.dingtalkBotConfig?.memoryLimit || 30)} ${t ? "轮记忆" : "turns"}`,
        note: at(!!e?.dingtalkBotConfig?.enableTTS, t)
      },
      {
        id: "telegram",
        label: "Telegram",
        running: !!e?.isTelegramBotRunning,
        status: Ct(!!e?.isTelegramBotRunning, t),
        agent: String(e?.telegramBotConfig?.TelegramAgent || "openxnet-model"),
        memory: `${Number(e?.telegramBotConfig?.memoryLimit || 20)} ${t ? "轮记忆" : "turns"}`,
        note: at(!!e?.telegramBotConfig?.enableTTS, t)
      },
      {
        id: "discord",
        label: "Discord",
        running: !!e?.isDiscordBotRunning,
        status: Ct(!!e?.isDiscordBotRunning, t),
        agent: String(e?.discordBotConfig?.llm_model || "openxnet-model"),
        memory: `${Number(e?.discordBotConfig?.memory_limit || 30)} ${t ? "轮记忆" : "turns"}`,
        note: at(!!e?.discordBotConfig?.enable_tts, t)
      },
      {
        id: "slack",
        label: "Slack",
        running: !!e?.isSlackBotRunning,
        status: Ct(!!e?.isSlackBotRunning, t),
        agent: String(e?.slackBotConfig?.llm_model || "openxnet-model"),
        memory: `${Number(e?.slackBotConfig?.memory_limit || 30)} ${t ? "轮记忆" : "turns"}`,
        note: at(!!e?.slackBotConfig?.enable_tts, t)
      }
    ],
    liveChannels: [
      {
        id: "bilibili",
        label: "Bilibili",
        enabled: !!e?.liveConfig?.bilibili_enabled,
        status: at(!!e?.liveConfig?.bilibili_enabled, t),
        note: String(e?.liveConfig?.bilibili_room_id || (t ? "未填写房间号" : "No room id"))
      },
      {
        id: "youtube",
        label: "YouTube",
        enabled: !!e?.liveConfig?.youtube_enabled,
        status: at(!!e?.liveConfig?.youtube_enabled, t),
        note: String(e?.liveConfig?.youtube_vedio_id || (t ? "未填写视频 ID" : "No video id"))
      },
      {
        id: "twitch",
        label: "Twitch",
        enabled: !!e?.liveConfig?.twitch_enabled,
        status: at(!!e?.liveConfig?.twitch_enabled, t),
        note: String(e?.liveConfig?.twitch_channel || (t ? "未填写频道" : "No channel"))
      }
    ],
    liveStrategy: {
      runtime: Ct(!!e?.isLiveRunning, t, "直播中", "Live"),
      danmakuOnly: Rc(!!e?.liveConfig?.onlyDanmaku),
      queueLimit: Number(e?.liveConfig?.danmakuQueueLimit || 5),
      wakeWord: String(e?.liveConfig?.wakeWord || (t ? "未设置唤醒词" : "No wake word")),
      obsUrl: `${String(e?.partyURL || "").replace(/\/$/, "")}/vrm.html?mode=render`
    },
    readBot: {
      runtime: Ct(!!e?.isReadRunning, t, "朗读中", "Reading"),
      selectedFile: (() => {
        const u = I(e?.textFiles).find((d) => String(d?.unique_filename || "") === String(e?.selectedFile || ""));
        return String(u?.original_filename || u?.unique_filename || (t ? "未选择文件" : "No file selected"));
      })(),
      segments: I(e?.readConfig?.longTextList).length,
      preview: Wt(e?.readConfig?.longText || (t ? "当前还没有载入朗读内容。" : "No reading content is loaded yet."), 140),
      audioState: e?.readState?.isPlaying ? t ? "播放中" : "Playing" : t ? "待播放" : "Idle"
    },
    translateBot: {
      runtime: String(e?.targetLangSelected || (t ? "系统默认" : "system")),
      sourceLength: String(e?.sourceText || "").length,
      targetLength: String(e?.translatedText || "").length,
      busy: !!e?.isTranslating,
      sourcePreview: Wt(e?.sourceText || (t ? "还没有待翻译内容。" : "No source text yet."), 180),
      resultPreview: Wt(e?.translatedText || (t ? "翻译结果会显示在这里。" : "Translated output will appear here."), 180)
    },
    generalConfig: {
      mediaHostEnabled: at(!!e?.BotConfig?.imgHost_enabled, t),
      mediaHost: String(e?.BotConfig?.imgHost || "smms"),
      easyImage: String(e?.BotConfig?.EI2_base_url || (t ? "未配置 EasyImage2 地址" : "No EasyImage2 URL")),
      githubRepo: [e?.BotConfig?.github_repo_owner, e?.BotConfig?.github_repo_name].filter(Boolean).join("/") || (t ? "未配置 GitHub 仓库" : "No GitHub repository"),
      giteeRepo: [e?.BotConfig?.gitee_repo_owner, e?.BotConfig?.gitee_repo_name].filter(Boolean).join("/") || (t ? "未配置 Gitee 仓库" : "No Gitee repository")
    }
  };
}
function Pc(e, t) {
  const s = I(e?.apiTiles).map((F) => ({
    id: String(F?.id || ""),
    icon: String(F?.icon || "fa-solid fa-circle"),
    label: ul(e, F, t)
  })), i = String(e?.subMenu || "develop"), a = e?.getPrototypeApiDetailMeta?.(i) || {
    title: t ? "开发者工作台" : "Developer Workbench",
    summary: t ? "统一查看 API 接入、开发流与本地工作区状态。" : "Review API routes, workflows, and local workspace status in one place.",
    chips: []
  }, u = I(e?.devWorkbenchOverview?.configuration_readiness?.items).map((F) => ({
    id: String(F?.id || F?.label || ""),
    label: e?.formatDevReadinessLabel?.(F?.id) || String(F?.label || ""),
    status: e?.formatDevReadinessStatus?.(F?.status) || String(F?.status || ""),
    note: String(F?.note || F?.summary || "")
  })), d = I(e?.devWorkbenchOverview?.recent_dev_tasks || e?.recent_dev_tasks || []).map((F) => ({
    id: String(F?.task_id || F?.id || ""),
    title: String(F?.title || F?.goal || (t ? "未命名开发任务" : "Untitled developer task")),
    status: String(F?.status || ""),
    workflow: e?.formatDevWorkflowKind?.(F?.workflow_kind) || String(F?.workflow_kind || ""),
    updatedAt: Tn(F?.updated_at || F?.created_at || F?.timestamp || "")
  })), p = e?.devWorkbenchOverview || {}, g = p.runtime_profile || {}, S = p.configuration_assistant || {}, b = S.provider_setup || {}, w = S.gateway_provider_setup || {}, V = S.mapping_setup || {}, L = S.workspace_setup || {}, Z = p.task_stats || {}, W = p.capability_summary || {}, ae = p.workflow_support || {};
  return {
    title: t ? "开发者 · 工作台" : "Developer Workbench",
    subtitle: t ? "API 接口、智能体管理与开发者工具" : "API routes, agent management, and developer tools",
    tabs: s,
    activeTab: i,
    meta: a,
    stats: Ln(e?.getPrototypeApiDetailStats?.(i)),
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
        value: String(Z.developer || 0),
        note: `${Z.running || 0} ${t ? "个运行中" : "running"} · ${Z.resumable || 0} ${t ? "个可恢复" : "resumable"}`
      },
      {
        label: t ? "插件与模板" : "Plugins & Templates",
        value: String(p.plugin_count || 0),
        note: `${I(p.templates).length} ${t ? "个模板" : "templates"}`
      }
    ],
    readiness: u,
    warnings: I(e?.devWorkbenchOverview?.warnings),
    templates: I(e?.devWorkbenchOverview?.templates).map((F) => ({
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
      providerCount: I(b.provider_options).length,
      apiKeyConfigured: !!b.api_key_configured,
      validationStatus: String(e?.devWorkbenchProviderValidation?.status || ""),
      validationMessage: String(e?.devWorkbenchProviderValidation?.message || "")
    },
    gatewayCard: {
      enabled: !!w.enabled,
      reachable: !!w.reachable,
      status: String(w.status || ""),
      message: String(w.message || ""),
      vendor: String(e?.devWorkbenchGatewayProviderDraft?.vendor || w.current_vendor || ""),
      url: String(e?.devWorkbenchGatewayProviderDraft?.url || w.current_base_url || ""),
      model: String(e?.devWorkbenchGatewayProviderDraft?.model_id || w.current_model || ""),
      providerCount: I(w.provider_options).length,
      apiKeyConfigured: !!w.api_key_configured,
      managementUrl: String(w.management_url || "")
    },
    mappingCard: {
      status: String(V.status || ""),
      message: String(V.message || ""),
      agent: String(e?.devWorkbenchMappingDraft?.agent_id || V.current_main_agent || ""),
      resolvedModel: String(V.resolved_model || ""),
      currentModel: String(V.current_model || ""),
      resolutionSource: String(V.resolution_source || ""),
      providerModelCount: I(V.provider_models).length,
      agentCount: I(V.agent_options).length
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
    capabilitySummary: Object.entries(W).map(([F, G]) => ({
      id: F,
      label: e?.formatDevCapabilityLabel?.(F) || F,
      enabled: !!G
    })),
    workflowSupport: Object.entries(ae).filter(([F]) => !["write_enabled", "collaboration"].includes(F)).map(([F, G]) => ({
      id: F,
      label: e?.formatDevWorkflowKind?.(F) || F,
      enabled: !!G
    }))
  };
}
const Ac = [
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
function Dc(e, t) {
  const s = String(e?.enterpriseTab || "usage"), i = Ac.map((x) => ({
    ...x,
    label: e?.getPrototypeEnterpriseTitle?.(x.id) || x.id
  })), a = e?.usageData?.summary || {}, u = I(e?.usageData?.trend).slice().reverse().slice(0, 8).map((x, B) => ({
    id: `${x?.period || "trend"}-${B}`,
    label: String(x?.period || "").slice(-5) || `#${B + 1}`,
    value: Number(x?.total_tokens || 0)
  })), d = I(e?.usageData?.models).slice(0, 6).map((x, B) => ({
    id: `${x?.model || "model"}-${B}`,
    name: x?.model || t ? "未命名模型" : "Unnamed model",
    requests: Number(x?.requests || 0),
    tokens: Number(x?.total_tokens || 0),
    cost: Number(x?.cost || 0)
  })), p = I(e?.usageData?.users).slice(0, 6).map((x, B) => ({
    id: `${x?.user_id || "user"}-${B}`,
    name: x?.user_id || t ? "未命名用户" : "Unknown user",
    requests: Number(x?.requests || 0),
    tokens: Number(x?.total_tokens || 0),
    latency: Math.round(Number(x?.avg_duration_ms || 0))
  })), g = e?.neuroData?.stats || {}, S = I(e?.neuroData?.symbols).slice(0, 8).map((x, B) => ({
    id: String(x?.id || `symbol-${B}`),
    operator: String(x?.operator || "-"),
    label: x?.label || t ? "未命名符号" : "Unnamed symbol",
    entities: I(x?.K?.entities).slice(0, 4),
    successRate: Number(x?.successRate || 0),
    activations: Number(x?.activationCount || 0)
  })), b = I(e?.neuroData?.rules).slice(0, 6).map((x, B) => ({
    id: String(x?.id || `rule-${B}`),
    name: x?.name || t ? "未命名规则" : "Unnamed rule",
    domain: String(x?.domain || "-"),
    enabled: !!x?.enabled,
    description: String(x?.description || "")
  })), w = e?.kgData?.stats || {}, V = I(e?.kgData?.entityFacts).slice(0, 8).map((x, B) => ({
    id: `fact-${B}`,
    subject: String(x?.subject || x?.source || "-"),
    predicate: String(x?.predicate || x?.label || "-"),
    object: String(x?.object || x?.target || "-")
  })), L = I(e?.enterpriseKBs).map((x, B) => ({
    id: String(x?.id || `kb-${B}`),
    name: String(x?.name || (t ? "未命名知识库" : "Unnamed KB")),
    category: String(x?.category || (t ? "未分类" : "Uncategorized")),
    docs: Number(x?.doc_count || 0),
    description: String(x?.description || ""),
    updatedAt: Tn(x?.updated_at || x?.created_at || "")
  })), Z = I(e?.enterpriseRoleCards || e?.staffRoles), W = Z.map((x, B) => ({
    id: String(x?.id || `role-${B}`),
    name: String(x?.name || (t ? "未命名角色" : "Unnamed role")),
    department: String(x?.department || (t ? "未分配部门" : "Unassigned")),
    workspaceId: String(x?.assignedWorkspace || ""),
    workspace: e?.getEnterpriseWorkspaceNameById?.(x?.assignedWorkspace) || String(x?.assignedWorkspace || ""),
    skills: I(x?.skills).slice(0, 6),
    summary: String(x?.summaryZh || x?.summaryEn || x?.description || x?.system_prompt || ""),
    icon: String(x?.icon || "fa-solid fa-user-tie"),
    enabled: x?.enabled !== !1,
    templateId: String(x?.templateId || ""),
    category: String(x?.category || ""),
    categoryLabel: String(
      t ? x?.categoryZh || x?.categoryEn || x?.category || "未分类" : x?.categoryEn || x?.categoryZh || x?.category || "Uncategorized"
    ),
    accent: I(x?.accent).slice(0, 2)
  })).sort((x, B) => x.enabled !== B.enabled ? x.enabled ? -1 : 1 : String(x.name || "").localeCompare(String(B.name || ""), "zh-Hans-CN")), ae = Object.entries(e?.staffRoleTemplates || {}).map(([x, B]) => ({
    id: x,
    name: String(B?.name || x),
    department: String(B?.department || ""),
    summary: String(B?.summaryZh || B?.summaryEn || ""),
    skills: I(B?.skills).slice(0, 6),
    icon: String(B?.icon || "fa-solid fa-user-tie"),
    category: String(B?.category || ""),
    categoryLabel: String(
      t ? B?.categoryZh || B?.categoryEn || B?.category || "未分类" : B?.categoryEn || B?.categoryZh || B?.category || "Uncategorized"
    ),
    categoryZh: String(B?.categoryZh || ""),
    categoryEn: String(B?.categoryEn || ""),
    featured: !!B?.featured,
    priority: Number(B?.priority || 0),
    accent: I(B?.accent).slice(0, 2)
  })).sort((x, B) => x.featured !== B.featured ? x.featured ? -1 : 1 : Number(B.priority || 0) - Number(x.priority || 0)), F = I(e?.enterpriseWorkspaces).map((x, B) => {
    const re = String(x?.id || "");
    return {
      id: re || `ws-${B}`,
      name: x?.name || t ? "未命名工作空间" : "Unnamed workspace",
      type: e?.getEnterpriseWorkspaceTypeLabel?.(x) || String(x?.type || "-"),
      permission: String(x?.permission || "default"),
      projectCount: I(e?.enterpriseProjects).filter((he) => String(he?.workspaceId || "") === re).length,
      roleCount: I(e?.staffRoles || e?.enterpriseRoleCards).filter((he) => String(he?.assignedWorkspace || "") === re).length,
      summary: e?.describeEnterpriseWorkspace?.(x) || String(x?.path || x?.host || "-"),
      path: String(x?.path || x?.host || "-"),
      updatedAt: Tn(x?.updatedAt || x?.createdAt || "")
    };
  }), G = String(e?.sandboxCurrentWs || ""), ne = String(e?.sandboxCurrentProject || ""), U = String(e?.selected3DAgent?.id || ""), se = I(e?.enterpriseWorkspaces).find((x) => String(x?.id || "") === G) || null, Ee = I(e?.enterpriseProjects).find((x) => String(x?.id || "") === ne) || null, Pe = I(e?.enterpriseProjects).filter((x) => !G || String(x?.workspaceId || "") === G).map((x, B) => ({
    id: String(x?.id || `project-${B}`),
    name: String(x?.name || (t ? "未命名项目" : "Untitled project")),
    workspaceId: String(x?.workspaceId || ""),
    workspace: e?.getEnterpriseWorkspaceNameById?.(x?.workspaceId) || "",
    color: String(x?.color || "#4ecdc4"),
    icon: String(x?.icon || "fa-solid fa-folder"),
    description: String(x?.description || ""),
    floor: Number(x?.floor || B + 1)
  })), Ke = new Map(
    Z.map((x) => [String(x?.id || "").trim(), x])
  ), K = I(e?.sandboxAgents).map((x, B) => {
    const re = Ke.get(String(x?.id || "").trim()) || null;
    return {
      id: String(x?.id || `agent-${B}`),
      name: String(x?.name || x?.agent_name || re?.name || (t ? "未命名智能体" : "Unnamed agent")),
      role: String(x?.role || x?.department || re?.department || "-"),
      department: String(x?.department || x?.role || re?.department || "-"),
      status: String(x?.status || (t ? "未知" : "unknown")),
      workspaceId: String(x?.workspaceId || re?.assignedWorkspace || ""),
      workspace: String(x?.workspace_name || e?.getEnterpriseWorkspaceNameById?.(x?.workspaceId || re?.assignedWorkspace) || x?.workspaceId || re?.assignedWorkspace || ""),
      projectId: String(x?.projectId || re?.projectId || ""),
      project: String(x?.project_name || x?.projectId || re?.projectId || ""),
      icon: String(x?.icon || re?.icon || "fa-solid fa-user-tie"),
      skills: I(x?.skills || re?.skills).slice(0, 6),
      summary: String(x?.summary || re?.summaryZh || re?.summaryEn || re?.description || re?.system_prompt || ""),
      enabled: re?.enabled !== !1
    };
  }).filter((x) => ne ? String(x?.projectId || "") === ne : G ? String(x?.workspaceId || "") === G : !0), we = [];
  we.push({
    id: "root",
    level: 0,
    label: t ? "企业园区" : "Enterprise Campus"
  }), se && we.push({
    id: se.id,
    level: 1,
    label: se.name
  }), Ee && we.push({
    id: Ee.id,
    level: 2,
    label: Ee.name
  });
  const He = ["dataops", "mlops", "aiops"].map((x) => {
    const B = e?.xnetServices?.[x] || {};
    return {
      id: x,
      title: String(B?.name || x),
      status: String(B?.status || "offline"),
      url: String(B?.url || ""),
      autoConnect: !!B?.auto_connect,
      lastCheck: Tn(B?.last_check || "")
    };
  });
  return {
    title: t ? "企业空间" : "Enterprise Space",
    subtitle: t ? "统一沉淀企业知识、角色、工作区与运营指标" : "Unify enterprise knowledge, roles, workspaces, and operating signals",
    tabs: i,
    activeTab: s,
    meta: e?.getPrototypeEnterpriseDetailMeta?.(s) || { title: "", summary: "", chips: [] },
    stats: Ln(e?.getPrototypeEnterpriseDetailStats?.(s)),
    topStats: [
      {
        title: t ? "总请求量" : "Requests",
        value: String(a.total_requests || 0),
        note: t ? "当前企业视图累计请求" : "Total requests inside the enterprise view"
      },
      {
        title: t ? "知识库文档" : "KB Docs",
        value: String(e?.enterpriseKBTotalDocs || 0),
        note: `${I(e?.enterpriseKBs).length} ${t ? "个知识库" : "knowledge bases"}`
      },
      {
        title: t ? "角色卡" : "Role Cards",
        value: String(Z.length),
        note: `${I(e?.enterpriseWorkspaces).length} ${t ? "个工作空间" : "workspaces"}`
      },
      {
        title: t ? "沙盘智能体" : "Sandbox Agents",
        value: String(I(e?.sandboxAgents).length),
        note: `${I(e?.enterpriseSkills).length} ${t ? "个企业技能" : "enterprise skills"}`
      }
    ],
    overviewCards: [
      {
        title: t ? "知识库" : "Knowledge Bases",
        value: String(I(e?.enterpriseKBs).length),
        note: t ? "企业级共享知识与文档空间" : "Shared enterprise knowledge and docs"
      },
      {
        title: t ? "员工角色卡" : "Staff Roles",
        value: String(Z.length),
        note: t ? "沉淀可复用的企业 AI 岗位能力" : "Reusable enterprise AI role templates"
      },
      {
        title: t ? "工作空间" : "Workspaces",
        value: String(I(e?.enterpriseWorkspaces).length),
        note: t ? "按项目或团队隔离资源边界" : "Project or team level resource boundaries"
      },
      {
        title: t ? "沙盘智能体" : "Sandbox Agents",
        value: String(I(e?.sandboxAgents).length),
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
      trend: u,
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
      symbols: S,
      rules: b
    },
    kgPanel: {
      metrics: [
        { label: t ? "实体" : "Entities", value: String(w.entities || I(e?.kgData?.graph?.nodes).length || 0) },
        { label: t ? "三元组" : "Triples", value: String(w.triples || 0) },
        { label: t ? "节点" : "Nodes", value: String(I(e?.kgData?.graph?.nodes).length || 0) },
        { label: t ? "边" : "Edges", value: String(I(e?.kgData?.graph?.edges).length || 0) }
      ],
      facts: V
    },
    knowledgePanel: {
      totalDocs: Number(e?.enterpriseKBTotalDocs || 0),
      totalCount: L.length,
      items: L
    },
    rolePanel: {
      templateCount: ae.length,
      createdCount: W.length,
      enabledCount: W.filter((x) => x.enabled).length,
      items: W,
      templates: ae
    },
    workspacePanel: {
      totalCount: F.length,
      items: F
    },
    sandboxPanel: {
      level: Number(e?.sandboxLevel || 0),
      levelLabel: Number(e?.sandboxLevel || 0) === 0 ? t ? "企业园区" : "Enterprise Campus" : Number(e?.sandboxLevel || 0) === 1 ? t ? "工作空间层" : "Workspace Layer" : t ? "项目楼层" : "Project Floor",
      currentWorkspaceId: G,
      currentWorkspace: String(se?.name || G || ""),
      currentProjectId: ne,
      currentProject: String(Ee?.name || ne || ""),
      selectedAgentId: U,
      breadcrumb: we,
      workspaceCount: F.length,
      projectCount: Pe.length,
      roleCount: K.length,
      workspaces: F.slice(0, 8),
      projects: Pe.slice(0, 8),
      items: K
    },
    xnetPanel: {
      items: He
    }
  };
}
function $t() {
  const e = kt();
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
  ].some((s) => typeof e[s] != "function"))
    throw new Error("SynapXnet Memory runtime is unavailable.");
  return e;
}
function mi(e, t) {
  const s = e?.agents && typeof e.agents == "object" ? e.agents : {}, i = I(e?.enterpriseRoleCards || e?.staffRoles), a = [
    {
      id: String(e?.mainAgent || "openxnet-model"),
      name: t ? "当前主智能体" : "Current main agent"
    },
    ...Object.entries(s).map(([d, p]) => ({
      id: String(d),
      name: String(p?.name || d)
    })),
    ...i.map((d) => ({
      id: String(d?.id || ""),
      name: String(d?.name || d?.displayName || d?.id || "")
    }))
  ], u = /* @__PURE__ */ new Set();
  return a.filter((d) => d.id && !u.has(d.id) && u.add(d.id));
}
async function _i(e) {
  const t = String(e || "").trim();
  if (!t)
    return z.selectedMemoryId = "", z.selectedMemory = null, z.history = [], null;
  const i = await $t().getSynapxnetMemoryHistory({
    memoryId: t,
    requesterAgent: z.actorAgent
  }), a = Array.isArray(i?.versions) ? i.versions : [], u = [...a].sort((d, p) => Number(p?.version || 0) - Number(d?.version || 0))[0] || null;
  return z.selectedMemoryId = t, z.selectedMemory = u, z.history = a, u;
}
async function Ft(e = {}) {
  const t = J(), s = $t(), i = mi(t, vs(t));
  z.actorAgent = String(
    e.actorAgent || z.actorAgent || i[0]?.id || "openxnet-model"
  ).trim(), z.query = String(e.query ?? z.query ?? "").trim(), z.includeRetired = e.includeRetired === void 0 ? z.includeRetired : !!e.includeRetired, z.loading = !0, z.error = "";
  try {
    z.recoveryAttempted || (z.recovery = await s.recoverSynapxnetMemories({
      actorAgent: z.actorAgent
    }), z.recoveryAttempted = !0, z.recovery?.integrity && (z.integrity = z.recovery.integrity));
    const [a, u] = await Promise.all([
      s.getSynapxnetMemoryStatus(),
      s.listSynapxnetMemories({
        requesterAgent: z.actorAgent,
        query: z.query,
        ownerAgent: "",
        includeRetired: z.includeRetired,
        limit: 500
      })
    ]);
    z.status = a, z.items = Array.isArray(u?.items) ? u.items : [];
    const d = z.items.some((p) => p.memoryId === z.selectedMemoryId) ? z.selectedMemoryId : String(z.items[0]?.memoryId || "");
    return await _i(d), u;
  } catch (a) {
    throw z.error = String(a?.message || "SynapXnet Memory runtime is unavailable."), a;
  } finally {
    z.loading = !1;
  }
}
async function Ic(e) {
  return z.error = "", _i(e);
}
async function Vc(e = {}) {
  const t = $t(), s = z.actorAgent || "openxnet-model", i = await t.createSynapxnetMemory({
    ownerAgent: s,
    actorAgent: s,
    taskId: String(e.taskId || "").trim(),
    title: String(e.title || "").trim(),
    content: String(e.content || "").trim(),
    qualityScore: Number(e.qualityScore ?? 0.8),
    permissions: Array.isArray(e.permissions) ? e.permissions : [],
    tags: Array.isArray(e.tags) ? e.tags : [],
    source: "user-created"
  });
  return z.selectedMemoryId = i.memoryId, await Ft(), i;
}
async function Oc(e = {}) {
  const s = await $t().editSynapxnetMemory({
    memoryId: String(e.memoryId || "").trim(),
    baseVersion: Number(e.baseVersion || 0),
    actorAgent: z.actorAgent || "openxnet-model",
    title: String(e.title || "").trim(),
    content: String(e.content || "").trim(),
    qualityScore: Number(e.qualityScore ?? 0.8),
    permissions: Array.isArray(e.permissions) ? e.permissions : [],
    tags: Array.isArray(e.tags) ? e.tags : [],
    reason: String(e.reason || "").trim()
  });
  return z.selectedMemoryId = s.memoryId, await Ft(), s;
}
async function $c(e, t, s = "") {
  const a = await $t().rollbackSynapxnetMemory({
    memoryId: String(e || "").trim(),
    targetVersion: Number(t || 0),
    actorAgent: z.actorAgent || "openxnet-model",
    reason: String(s || "").trim()
  });
  return z.selectedMemoryId = a.memoryId, await Ft(), a;
}
async function Fc(e) {
  const s = await $t().retireSynapxnetMemory({
    memoryId: String(e || "").trim(),
    actorAgent: z.actorAgent || "openxnet-model"
  });
  return z.selectedMemoryId = s.memoryId, await Ft(), s;
}
async function Nc(e = []) {
  return $t().exportSynapxnetMemories({
    requesterAgent: z.actorAgent || "openxnet-model",
    memoryIds: [...e]
  });
}
async function Lc(e) {
  const t = z.actorAgent || "openxnet-model", s = await $t().importSynapxnetMemories({
    actorAgent: t,
    targetOwnerAgent: t,
    document: e
  });
  return await Ft(), s;
}
async function jc(e = "") {
  const t = await $t().verifySynapxnetMemory({
    requesterAgent: z.actorAgent || "openxnet-model",
    memoryId: String(e || "").trim()
  });
  return z.integrity = t, t;
}
function Bc(e, t) {
  const s = mi(e, t);
  return z.actorAgent || (z.actorAgent = s[0]?.id || "openxnet-model"), {
    available: !!kt()?.listSynapxnetMemories,
    ...z,
    items: [...z.items],
    history: [...z.history],
    agentOptions: s
  };
}
function Wc(e, t) {
  const s = I(e?.storageTiles).map((p) => ({
    id: String(p?.id || ""),
    icon: String(p?.icon || "fa-solid fa-circle"),
    label: ul(e, p, t)
  }));
  s.some((p) => p.id === "memory-v3") || s.push({ id: "memory-v3", icon: "fa-solid fa-brain", label: "Memory V3" });
  const i = String(e?.subMenu || "text"), a = I(e?.textFiles).slice(0, 8).map((p, g) => ({
    id: String(p?.id || p?.path || `text-${g}`),
    name: String(p?.original_filename || p?.unique_filename || p?.name || (t ? "未命名文件" : "Untitled file")),
    ext: e?.getPrototypeStorageFileExtension?.(p) || "",
    size: e?.getPrototypeStorageFileDisplaySize?.(p) || "",
    time: e?.getPrototypeStorageFileDisplayTime?.(p) || ""
  })), u = I(e?.imageFiles).slice(0, 6).map((p, g) => ({
    id: String(p?.id || p?.path || `image-${g}`),
    name: String(p?.original_filename || p?.unique_filename || p?.name || (t ? "未命名图片" : "Untitled image")),
    size: e?.getPrototypeStorageFileDisplaySize?.(p) || ""
  })), d = I(e?.recallResults).slice(0, 6).map((p, g) => ({
    id: String(p?.task_id || p?.id || `recall-${g}`),
    title: Wt(p?.title || p?.summary || p?.query || (t ? "续接任务" : "Recall item"), 56),
    note: Wt(p?.content || p?.description || p?.source || "", 80)
  }));
  return {
    title: t ? "存储管理" : "Storage Manager",
    subtitle: t ? "统一管理文本、图片、视频和续接素材" : "Manage text, images, videos, and recall assets together",
    tabs: s,
    activeTab: i,
    meta: i === "memory-v3" ? {
      title: "SynapXnet Memory V3",
      summary: t ? "可共享、可编辑、可追溯、可回滚的长期记忆。" : "Shareable, editable, traceable, and rollback-capable long-term memory.",
      chips: []
    } : e?.getPrototypeStorageDetailMeta?.(i) || { title: "", summary: "", chips: [] },
    stats: i === "memory-v3" ? [
      { label: t ? "长期记忆" : "Memories", value: String(z.status?.tiers?.longTerm?.memories || 0) },
      { label: t ? "版本" : "Versions", value: String(z.status?.tiers?.longTerm?.versions || 0) },
      { label: t ? "共享版本" : "Shared", value: String(z.status?.sharedVersions || 0) },
      { label: t ? "审计事件" : "Audit Events", value: String(z.status?.auditEvents || 0) }
    ] : Ln(e?.getPrototypeStorageDetailStats?.(i)),
    overviewStats: I(e?.getPrototypeStorageOverviewStats?.()),
    textFiles: a,
    imageFiles: u,
    videoFiles: [
      { id: "video-1", name: "product-demo.mp4", size: "128 MB", duration: "04:32" },
      { id: "video-2", name: "training-session.mov", size: "1.2 GB", duration: "45:08" },
      { id: "video-3", name: "bug-repro.webm", size: "45 MB", duration: "02:47" }
    ],
    recallItems: d,
    memoryV3: Bc(e, t)
  };
}
function Uc(e, t) {
  const s = String(e?.kernelConsoleTab || "overview"), i = [
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
    tabs: i,
    activeTab: s,
    metrics: I(e?.getKernelConsoleMetrics?.()),
    runtimeRows: I(e?.getKernelConsoleRuntimeRows?.()),
    profileRows: I(e?.getKernelConsoleProfileRows?.()),
    boardItems: I(e?.getKernelConsoleBoardItems?.()),
    actions: I(e?.getKernelConsoleVisibleActions?.()).slice(0, 8).map((a) => ({
      id: String(a?.id || a?.task_id || a?.created_at || Math.random()),
      title: String(a?.title || a?.summary || a?.task || (t ? "内核动作" : "Kernel action")),
      type: e?.getKernelConsoleActionLabel?.(a?.type || a?.action_type || "") || String(a?.type || a?.action_type || ""),
      status: e?.getKernelConsoleActionStatusLabel?.(a) || String(a?.status || ""),
      next: e?.getKernelConsoleActionNextLabel?.(a) || ""
    })),
    updatedLabel: e?.getKernelConsoleUpdatedLabel?.() || ""
  };
}
function Kc(e, t) {
  const s = I(e?.getPrototypeSystemTabs?.()).map((p) => ({
    id: String(p?.id || ""),
    icon: String(p?.icon || "fa-solid fa-circle"),
    label: String(p?.label || p?.id || "")
  }));
  s.some((p) => p.id === "feature-packs") || s.splice(Math.max(0, s.length - 1), 0, {
    id: "feature-packs",
    icon: "fa-solid fa-cubes",
    label: t ? "功能包" : "Feature Packs"
  });
  const i = String(e?.prototypeSystemTab || "general"), a = I(e?.themeOptions).length ? I(e?.themeOptions).map((p) => Is(e, p)) : I(e?.themeValues).map((p) => ({
    value: String(p),
    label: typeof e?.getPrototypeThemeLabel == "function" ? e.getPrototypeThemeLabel(p) : gi(e, `theme.${p}`, String(p))
  })), u = I(e?.networkOptions).map((p) => Is(e, p)), d = I(e?.systemlanguageOptions).map((p) => Is(e, p));
  return {
    title: t ? "系统设置" : "System Settings",
    subtitle: t ? "统一管理外观、网络、快捷键、更新内容与运行维护配置" : "Manage appearance, network, shortcuts, update content, and runtime maintenance settings",
    tabs: s,
    activeTab: i,
    stats: Ln(e?.getPrototypeSystemStats?.()),
    currentMeta: i === "feature-packs" ? {
      heading: t ? "功能包管理" : "Feature Pack Management",
      summary: t ? "按需安装独立运行时，并验证发布签名与文件完整性。" : "Install optional runtimes on demand with release signature and file integrity verification."
    } : e?.getPrototypeSystemTabMeta?.(i) || { heading: "", summary: "" },
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
    networkOptions: u.length ? u : [
      { value: "local", label: t ? "本机可见" : "Local only" },
      { value: "global", label: t ? "局域网可见" : "LAN visible" }
    ],
    proxyOptions: [
      { value: "system", label: t ? "系统代理" : "System proxy" },
      { value: "manual", label: t ? "手动代理" : "Manual proxy" },
      { value: "none", label: t ? "不使用代理" : "No proxy" }
    ],
    shortcutRows: I(e?.getPrototypeShortcutRows?.()),
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
    updateEntries: I(e?.getPrototypeSystemUpdateEntries?.()),
    featurePacks: Mc(t)
  };
}
function Hc(e, t) {
  const s = I(e?.getPrototypeTaskBoardColumns?.()).map((a) => ({
    id: String(a?.id || ""),
    title: String(a?.title || ""),
    emptyTitle: String(a?.emptyTitle || ""),
    emptyCopy: String(a?.emptyCopy || ""),
    tasks: I(a?.tasks).map((u) => ({
      raw: u,
      id: String(u?.task_id || u?.id || Math.random()),
      title: String(u?.title || u?.goal || (t ? "未命名任务" : "Untitled task")),
      summary: Wt(u?.description || u?.goal || u?.context?.goal || "", 96),
      status: String(u?.status || ""),
      updatedAt: Tn(u?.updated_at || u?.created_at || u?.timestamp || ""),
      progress: Number.isFinite(Number(u?.progress)) ? Number(u.progress) : null,
      assignee: String(u?.agent_name || u?.owner || u?.agent_type || "")
    }))
  })), i = e?.viewingTaskDetail || null;
  return {
    title: t ? "任务中心" : "Task Center",
    subtitle: t ? "查看待处理、进行中和已完成任务，并继续推进关键工作" : "Track pending, running, and completed tasks and keep work moving",
    columns: s,
    detail: i ? {
      title: String(i?.title || i?.goal || (t ? "任务详情" : "Task Detail")),
      status: String(i?.status || ""),
      summary: Wt(i?.description || i?.goal || "", 160),
      trace: I(i?.recent_trace_excerpt || i?.execution_trace).slice(0, 6).map((a, u) => ({
        id: `${i?.task_id || "detail"}-${u}`,
        text: Wt(typeof a == "string" ? a : a?.message || a?.summary || JSON.stringify(a), 120)
      }))
    } : null
  };
}
function qc(e, t) {
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
function zc(e, t) {
  const s = e?.VRMConfig || {}, i = (K, we, He = {}) => ({
    id: String(K?.id || ""),
    name: String(K?.name || K?.id || ""),
    path: String(K?.path || ""),
    builtin: we,
    cloud: !!K?.cloud || String(K?.source || "") === "cloud",
    source: String(K?.source || (we ? "packaged" : "user")),
    downloaded: K?.downloaded !== !1,
    downloadable: !!K?.downloadable,
    remoteUrl: String(K?.remoteUrl || ""),
    relativePath: String(K?.relativePath || ""),
    ...He
  }), a = I(s.defaultModels).map((K) => ({
    ...i(K, !0, { downloaded: !0, downloadable: !1 })
  })), u = I(s.cloudModels).map((K) => {
    const we = !!K?.downloaded;
    return i(K, !1, {
      cloud: !0,
      downloaded: we,
      downloadable: !we,
      source: "cloud"
    });
  }), d = I(s.userModels).map((K) => i(K, !1)), p = [...a, ...d], g = String(
    (s.name && s.name !== "default" ? s.selectedNewModelId : s.selectedModelId) || s.selectedModelId || p[0]?.id || ""
  ), S = p.find((K) => K.id === g) || p[0] || null, b = I(s.defaultMotions).map((K) => ({
    id: String(K?.id || ""),
    name: String(K?.name || K?.id || ""),
    builtin: !0
  })), w = I(s.userMotions).map((K) => ({
    id: String(K?.id || ""),
    name: String(K?.name || K?.id || ""),
    builtin: !1
  })), V = [...b, ...w], L = new Set(I(s.selectedMotionIds).map((K) => String(K))), Z = V.map((K) => ({
    ...K,
    selected: L.has(K.id)
  })), W = String(e?.partyURL || "").replace(/\/$/, ""), ae = new URLSearchParams({ mode: "embed" });
  g && ae.set("model", g);
  const F = Array.from(L).sort().join(",");
  F && ae.set("motions", F);
  const G = [
    g || "none",
    F || "no-motion",
    s.enabledExpressions ? "expr-on" : "expr-off",
    s.enabledMotions ? "motion-on" : "motion-off"
  ].join("|"), ne = W ? `${W}/vrm.html?${ae.toString()}` : "", U = !!e?.isVRMRunning, se = !!e?.isVRMStarting, Ee = !!e?.isVRMStopping, Pe = String(e?.mainAgent || "super-model"), Ke = e?.agents && typeof e.agents == "object" ? e.agents : {}, pt = [
    {
      id: "super-model",
      name: t ? "跟随当前主模型" : "Follow current main model"
    },
    ...Object.entries(Ke).map(([K, we]) => ({
      id: String(K),
      name: String(we?.name || K)
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
          text: t ? `当前模型 ${S?.name || "未选择"}` : `Current model: ${S?.name || "None"}`
        },
        {
          icon: "fa-solid fa-person-running",
          text: t ? `${Z.filter((K) => K.selected).length} 个动作已启用` : `${Z.filter((K) => K.selected).length} motions enabled`
        }
      ]
    },
    stats: [
      {
        label: t ? "运行状态" : "Status",
        value: U ? t ? "运行中" : "Running" : t ? "已停止" : "Stopped",
        meta: t ? "桌宠窗口的当前活动状态。" : "Current activity of the desktop pet window.",
        emphasis: U
      },
      {
        label: t ? "当前模型" : "Current Model",
        value: S?.name || (t ? "未选择" : "None"),
        meta: `${a.length} ${t ? "内置 + " : "built-in + "}${u.length} ${t ? "资源包 + " : "cloud + "}${d.length} ${t ? "自定义" : "custom"}`,
        truncate: !0
      },
      {
        label: t ? "动作" : "Motions",
        value: `${Z.filter((K) => K.selected).length} / ${V.length}`,
        meta: t ? "已启用 / 全部可用" : "Enabled / available"
      },
      {
        label: t ? "窗口尺寸" : "Window Size",
        value: `${Number(s.windowWidth || 540)} × ${Number(s.windowHeight || 960)}`,
        meta: t ? "宽 × 高（像素）" : "Width × Height (px)"
      }
    ],
    vrm: {
      selectedModelId: g,
      selectedModel: S,
      models: p,
      defaultModels: a,
      cloudModels: u,
      userModels: d,
      remoteResourceBaseUrl: String(s.remoteResourceBaseUrl || ""),
      motions: Z,
      selectedMotionIds: Array.from(L),
      enabledExpressions: !!s.enabledExpressions,
      enabledMotions: !!s.enabledMotions,
      windowWidth: Number(s.windowWidth || 540),
      windowHeight: Number(s.windowHeight || 960),
      running: U,
      starting: se,
      stopping: Ee,
      mainAgent: Pe,
      agentOptions: pt,
      previewUrl: ne,
      previewKey: G,
      partyURL: W,
      isElectron: !!e?.isElectron
    }
  };
}
function Yc(e) {
  const t = J(), s = vs(t), i = Tc(e), a = {
    surface: e,
    surfaceMenu: i,
    activeMenu: String(t?.activeMenu || ""),
    isZh: s,
    isActive: String(t?.activeMenu || "") === i
  };
  switch (e) {
    case "deploy":
      return { ...a, ...Ec(t, s) };
    case "vrm":
      return { ...a, ...zc(t, s) };
    case "workbench":
      return { ...a, ...Pc(t, s) };
    case "enterprise":
      return { ...a, ...Dc(t, s) };
    case "storage":
      return { ...a, ...Wc(t, s) };
    case "kernel":
      return { ...a, ...Uc(t, s) };
    case "system":
      return { ...a, ...Kc(t, s) };
    case "task":
      return { ...a, ...Hc(t, s) };
    case "about":
      return { ...a, ...qc(t, s) };
    default:
      return a;
  }
}
async function Hs(e) {
  e === "system" && await fs(!0);
  const t = J();
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
        String(t.subMenu || "") === "memory-v3" ? await Ft() : typeof t.switchStorageTile == "function" && await t.switchStorageTile(t.subMenu || "text");
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
            const s = await window.electronAPI.getAppVersion();
            s && (t.updateCurrentVersion = String(s));
          } catch {
          }
        break;
    }
}
async function Gc(e, t) {
  const s = J();
  if (s)
    switch (e) {
      case "deploy":
        s.subMenu = t, typeof s.ensureDeployBotReady == "function" && await s.ensureDeployBotReady(t);
        break;
      case "workbench":
        s.subMenu = t, t === "develop" && typeof s.loadDevWorkbench == "function" && await s.loadDevWorkbench();
        break;
      case "enterprise":
        typeof s.openEnterpriseTab == "function" ? await s.openEnterpriseTab(t) : s.enterpriseTab = t;
        break;
      case "storage":
        t === "memory-v3" ? (s.subMenu = "memory-v3", await Ft()) : typeof s.switchStorageTile == "function" ? await s.switchStorageTile(t) : s.subMenu = t;
        break;
      case "kernel":
        typeof s.openKernelTab == "function" ? await s.openKernelTab(t) : s.kernelConsoleTab = t;
        break;
      case "system":
        t === "feature-packs" ? s.prototypeSystemTab = t : typeof s.setPrototypeSystemTab == "function" ? s.setPrototypeSystemTab(t) : s.prototypeSystemTab = t;
        break;
    }
}
async function Qc(e) {
  const t = J();
  if (t)
    switch (e) {
      case "deploy":
        typeof t.refreshPrototypeDeployStatus == "function" && await t.refreshPrototypeDeployStatus(t.subMenu || "table_pet");
        break;
      case "vrm":
        await Hs(e);
        break;
      case "workbench":
        typeof t.loadDevWorkbench == "function" && await t.loadDevWorkbench();
        break;
      case "enterprise":
        typeof t.refreshPrototypeEnterpriseStatus == "function" && await t.refreshPrototypeEnterpriseStatus(t.enterpriseTab || "usage");
        break;
      case "storage":
        String(t.subMenu || "") === "memory-v3" ? await Ft() : await Hs(e);
        break;
      case "kernel":
        typeof t.loadKernelConsole == "function" && await t.loadKernelConsole();
        break;
      case "system":
        typeof t.refreshPrototypeSystemStatus == "function" && await t.refreshPrototypeSystemStatus(), await fs(!0);
        break;
      case "task":
        typeof t.fetchTasks == "function" && await t.fetchTasks();
        break;
    }
}
async function Xc() {
  const e = J();
  !e || typeof e.checkForUpdates != "function" || await e.checkForUpdates({ silent: !1 });
}
async function Jc() {
  const e = J();
  !e || typeof e.handleSelect != "function" || await e.handleSelect("logo");
}
async function En(e) {
  e && typeof e.autoSaveSettings == "function" && await e.autoSaveSettings();
}
async function hi(e) {
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
async function Zc(e, t) {
  const s = J();
  if (!s) return;
  (!s.systemSettings || typeof s.systemSettings != "object") && (s.systemSettings = {});
  const i = String(e || "").trim();
  if (!i) return;
  const u = (/* @__PURE__ */ new Set(["launchAtStartup", "startMinimized"])).has(i) ? !!t : String(t ?? "");
  if (i === "language" && typeof s.handleSystemLanguageChange == "function") {
    await s.handleSystemLanguageChange(u);
    return;
  }
  if (i === "theme" && typeof s.handleThemeChange == "function") {
    await s.handleThemeChange(u);
    return;
  }
  if (i === "network") {
    if (s.isElectron && typeof window < "u" && window.electronAPI?.setNetworkVisibility && typeof s.handleNetworkChange == "function") {
      await s.handleNetworkChange(u);
      return;
    }
    s.systemSettings.network = u, await En(s);
    return;
  }
  if (s.systemSettings[i] = u, i === "proxyMode" || i === "proxy") {
    typeof s.updateProxy == "function" ? await s.updateProxy() : (await En(s), s.isElectron || await fetch("/api/update_proxy", { method: "POST" }).catch(() => null));
    return;
  }
  await En(s), (i === "launchAtStartup" || i === "startMinimized") && await hi(s);
}
async function eu(e) {
  const t = J();
  t && (t.targetLangSelected = String(e || "system"), typeof t.changeLanguage == "function" ? t.changeLanguage() : await En(t));
}
async function tu() {
  const e = J();
  e && typeof e.clearPrototypeRuntimeCache == "function" && await e.clearPrototypeRuntimeCache();
}
async function nu(e) {
  const t = J();
  if (!t) return;
  const s = String(e || "").trim();
  if (s === "command-panel" && typeof t.openHomeCommandPanel == "function") {
    t.openHomeCommandPanel();
    return;
  }
  if (s === "desktop-control" && typeof t.openDesktopControlWorkbench == "function") {
    await t.openDesktopControlWorkbench();
    return;
  }
  if (s === "dynamic-island" && typeof t.openDynamicIslandSurface == "function") {
    await t.openDynamicIslandSurface();
    return;
  }
  s === "floating-task-hud" && typeof t.openFloatingTaskHudSurface == "function" && await t.openFloatingTaskHudSurface();
}
async function su(e) {
  const t = J();
  if (!t) return;
  const s = String(e || "").trim();
  if (s === "user" && typeof t.openUserfile == "function") {
    await t.openUserfile();
    return;
  }
  if (s === "logs" && typeof t.openLogfile == "function") {
    await t.openLogfile();
    return;
  }
  s === "extensions" && typeof t.openExtfile == "function" && await t.openExtfile();
}
async function lu() {
  const e = J();
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
  }, e.targetLangSelected = "system", typeof e.handleSystemLanguageChange == "function" && await e.handleSystemLanguageChange("auto"), typeof e.handleThemeChange == "function" && await e.handleThemeChange("party"), await En(e), await hi(e), typeof e.updateProxy == "function" ? await e.updateProxy() : e.isElectron || await fetch("/api/update_proxy", { method: "POST" }).catch(() => null), Gn(vs(e) ? "系统设置已恢复默认值" : "System settings reset to defaults", "success"));
}
async function ou() {
  const e = J();
  e && typeof e.ensureDeployBotReady == "function" && await e.ensureDeployBotReady("live_stream");
}
async function iu() {
  const e = J();
  e && typeof e.startVRM == "function" && await e.startVRM();
}
async function au() {
  const e = J();
  e && typeof e.startVRMweb == "function" && await e.startVRMweb();
}
async function ru(e) {
  const t = J();
  if (!t || !t.VRMConfig) return;
  const s = String(e || "");
  t.VRMConfig.name = "default", t.VRMConfig.selectedModelId = s, t.VRMConfig.selectedNewModelId = s, typeof t.saveVRMConfig == "function" ? await t.saveVRMConfig() : typeof t.handleModelChange == "function" ? await t.handleModelChange(s) : typeof t.autoSaveSettings == "function" && await t.autoSaveSettings();
}
function Gn(e, t = "info") {
  typeof window < "u" && typeof window.showNotification == "function" && window.showNotification(e, t);
}
async function cu(e) {
  const t = J();
  if (!t || !t.VRMConfig) return null;
  const s = vs(t), i = String(e || "");
  if (!i) return null;
  Gn(s ? "开始下载 VRM 模型..." : "Downloading VRM model...", "info");
  let a;
  if (t.isElectron) {
    if (typeof window.openxnetDesktop?.downloadApplicationCloudVrmModel != "function")
      throw new Error("Desktop VR Asset Runtime is unavailable.");
    const d = await window.openxnetDesktop.downloadApplicationCloudVrmModel({ modelId: i });
    a = { success: d.success, model: d.asset }, typeof t.invalidateApplicationVrAssetCatalog == "function" && t.invalidateApplicationVrAssetCatalog();
  } else {
    const d = await fetch(`/download_vrm_model/${encodeURIComponent(i)}`, {
      method: "POST"
    });
    if (a = await d.json().catch(() => ({})), !d.ok || !a?.success) {
      const p = a?.message || `Download failed (${d.status})`;
      throw Gn(p, "error"), new Error(p);
    }
  }
  const u = a.model || null;
  if (u?.id) {
    Array.isArray(t.VRMConfig.userModels) || (t.VRMConfig.userModels = []);
    const d = t.VRMConfig.userModels.findIndex((p) => String(p?.id || "") === String(u.id));
    d >= 0 ? t.VRMConfig.userModels.splice(d, 1, u) : t.VRMConfig.userModels.push(u), t.VRMConfig.selectedModelId = String(u.id), t.VRMConfig.selectedNewModelId = String(u.id), Array.isArray(t.VRMConfig.cloudModels) && (t.VRMConfig.cloudModels = t.VRMConfig.cloudModels.map((p) => String(p?.id || "") === String(u.id) ? { ...p, downloaded: !0, downloadable: !1, path: u.path } : p)), typeof t.saveVRMConfig == "function" ? await t.saveVRMConfig() : typeof t.autoSaveSettings == "function" && await t.autoSaveSettings();
  }
  return typeof t.loadDefaultModels == "function" && await t.loadDefaultModels(), Gn(s ? "VRM 模型已下载并选中" : "VRM model downloaded and selected", "success"), a;
}
async function uu(e) {
  const t = J();
  if (!t || !t.VRMConfig) return;
  Array.isArray(t.VRMConfig.selectedMotionIds) || (t.VRMConfig.selectedMotionIds = []);
  const s = t.VRMConfig.selectedMotionIds, i = s.indexOf(e);
  i === -1 ? s.push(e) : s.splice(i, 1), typeof t.handleMotionChange == "function" ? await t.handleMotionChange() : typeof t.autoSaveSettings == "function" && await t.autoSaveSettings();
}
async function du(e) {
  const t = J();
  !t || !t.VRMConfig || (t.VRMConfig.enabledExpressions = !!e, typeof t.autoSaveSettings == "function" && await t.autoSaveSettings());
}
async function pu(e) {
  const t = J();
  !t || !t.VRMConfig || (t.VRMConfig.enabledMotions = !!e, typeof t.autoSaveSettings == "function" && await t.autoSaveSettings());
}
async function fu(e) {
  const t = J();
  if (!t || !t.VRMConfig) return;
  const s = Number(e);
  Number.isFinite(s) && (t.VRMConfig.windowWidth = Math.max(300, Math.min(3840, Math.floor(s))), typeof t.autoSaveSettings == "function" && await t.autoSaveSettings());
}
async function vu(e) {
  const t = J();
  if (!t || !t.VRMConfig) return;
  const s = Number(e);
  Number.isFinite(s) && (t.VRMConfig.windowHeight = Math.max(300, Math.min(3840, Math.floor(s))), typeof t.autoSaveSettings == "function" && await t.autoSaveSettings());
}
async function gu(e) {
  const t = J();
  t && (t.mainAgent = String(e || "super-model"), typeof t.autoSaveSettings == "function" && await t.autoSaveSettings());
}
async function mu() {
  const e = J();
  e && (e.showVrmModelDialog = !0);
}
async function _u() {
  const e = J();
  e && (e.showVrmaMotionDialog = !0);
}
async function hu(e) {
  const t = J();
  t && typeof t.deleteModelOption == "function" && (await t.deleteModelOption(e), typeof t.loadDefaultModels == "function" && await t.loadDefaultModels());
}
async function yu(e) {
  const t = J();
  t && typeof t.deleteMotionOption == "function" && await t.deleteMotionOption(e);
}
async function bu() {
  const e = J();
  e && (typeof e.openTaskCenter == "function" ? e.openTaskCenter() : e.activeMenu = "task-center");
}
async function xu(e) {
  const t = J();
  !t || !e || typeof t.openTaskDetailView == "function" && await t.openTaskDetailView(e);
}
async function Su(e, t = "") {
  const s = J();
  s && (typeof s.handleSelect == "function" ? await s.handleSelect(e) : s.activeMenu = e, t && (e === "enterprise" ? s.enterpriseTab = t : e === "kernel" ? s.kernelConsoleTab = t : s.subMenu = t));
}
async function yi(e = "") {
  const t = J();
  if (!t) return;
  const s = String(e || "").trim(), i = s && I(t?.enterpriseRoleCards || t?.staffRoles).find((a) => String(a?.id || "") === s) || null;
  if (typeof t.openStaffRoleForm == "function") {
    t.openStaffRoleForm(i || null);
    return;
  }
  typeof t.createEmptyStaffRoleDraft == "function" && (t.newStaffRole = t.createEmptyStaffRoleDraft({ department: "" })), t.newSkillInput = "", t.showStaffRoleForm = !0;
}
async function ku(e) {
  const t = J();
  if (t) {
    if (typeof t.createStaffFromTemplate == "function") {
      t.createStaffFromTemplate(e);
      return;
    }
    await yi();
  }
}
async function wu(e) {
  const t = J();
  if (!(!t || !e)) {
    if (typeof t.removeStaffRole == "function") {
      await t.removeStaffRole(e);
      return;
    }
    typeof t.deleteRoleCard == "function" && await t.deleteRoleCard(e);
  }
}
async function Cu(e = "") {
  const t = J();
  if (!t) return;
  const s = String(e || "").trim(), i = s && I(t?.enterpriseWorkspaces).find((a) => String(a?.id || "") === s) || null;
  if (typeof t.openWorkspaceForm == "function") {
    t.openWorkspaceForm(i || null);
    return;
  }
  t.showWorkspaceForm = !0;
}
async function Mu(e) {
  const t = J();
  if (!(!t || !e)) {
    if (typeof t.openEnterpriseWorkspace == "function") {
      await t.openEnterpriseWorkspace(e);
      return;
    }
    typeof t.openEnterpriseTab == "function" ? await t.openEnterpriseTab("enterprise-sandbox") : t.enterpriseTab = "enterprise-sandbox", t.sandboxLevel = 1, t.sandboxCurrentWs = e;
  }
}
async function Ru(e) {
  const t = J();
  !t || !e || typeof t.removeWorkspace == "function" && await t.removeWorkspace(e);
}
async function Tu(e = "", t = "") {
  const s = J();
  if (!s) return;
  const i = String(t || "").trim(), a = i && I(s?.enterpriseProjects).find((u) => String(u?.id || "") === i) || null;
  if (typeof s.openProjectForm == "function") {
    s.openProjectForm(a || null, String(e || s.sandboxCurrentWs || ""));
    return;
  }
  s.newProject = {
    ...s.newProject || {},
    id: "",
    name: "",
    workspaceId: String(e || s.sandboxCurrentWs || ""),
    color: "#4ecdc4",
    icon: "fa-solid fa-folder",
    description: ""
  }, s.showProjectFloatPanel = !0;
}
async function Eu(e) {
  const t = J();
  !t || !e || typeof t.removeProject == "function" && await t.removeProject(e);
}
async function Pu(e) {
  const t = J();
  if (!t || !e) return;
  const s = I(t?.enterpriseProjects).find((i) => String(i?.id || "") === String(e || "")) || null;
  s && (typeof t.openEnterpriseTab == "function" ? await t.openEnterpriseTab("enterprise-sandbox") : t.enterpriseTab = "enterprise-sandbox", t.sandboxLevel = 2, t.sandboxCurrentWs = String(s.workspaceId || t.sandboxCurrentWs || ""), t.sandboxCurrentProject = String(s.id || ""), t.selected3DAgent = null, t.enterprise3DScene && typeof t.enterprise3DScene.showFloorView == "function" && (t.enterprise3DScene.showFloorView(s.id), typeof t.enterprise3DScene.resize == "function" && t.enterprise3DScene.resize()));
}
async function Au(e = 0, t = "") {
  const s = J();
  if (!s) return;
  const i = Math.max(0, Math.min(2, Number(e || 0)));
  if (i === 0) {
    s.sandboxLevel = 0, s.sandboxCurrentWs = null, s.sandboxCurrentProject = null, s.selected3DAgent = null, s.enterprise3DScene && typeof s.enterprise3DScene.showCityView == "function" && (s.enterprise3DScene.showCityView(), typeof s.enterprise3DScene.resize == "function" && s.enterprise3DScene.resize());
    return;
  }
  if (i === 1) {
    const d = String(t || s.sandboxCurrentWs || "").trim();
    if (!d) return;
    s.sandboxLevel = 1, s.sandboxCurrentWs = d, s.sandboxCurrentProject = null, s.selected3DAgent = null, s.enterprise3DScene && typeof s.enterprise3DScene.showBuildingView == "function" && (s.enterprise3DScene.showBuildingView(d), typeof s.enterprise3DScene.resize == "function" && s.enterprise3DScene.resize());
    return;
  }
  const a = String(t || s.sandboxCurrentProject || "").trim(), u = I(s?.enterpriseProjects).find((d) => String(d?.id || "") === a) || null;
  u && (s.sandboxLevel = 2, s.sandboxCurrentWs = String(u.workspaceId || s.sandboxCurrentWs || "").trim(), s.sandboxCurrentProject = String(u.id || "").trim(), s.selected3DAgent = null, s.enterprise3DScene && typeof s.enterprise3DScene.showFloorView == "function" && (s.enterprise3DScene.showFloorView(u.id), typeof s.enterprise3DScene.resize == "function" && s.enterprise3DScene.resize()));
}
async function Du(e) {
  const t = J();
  if (!t || !e) return;
  const s = I(t?.sandboxAgents).find((i) => String(i?.id || "") === String(e || "")) || I(t?.staffRoles).find((i) => String(i?.id || "") === String(e || "")) || null;
  if (s) {
    if (t.selected3DAgent = s, typeof t.onAgent3DDblClick == "function") {
      t.onAgent3DDblClick(s);
      return;
    }
    t.showSandboxChatPanel = !0;
  }
}
async function Iu(e = "", t = "") {
  const s = J();
  s && (typeof s.createEmptyStaffRoleDraft == "function" && (s.newStaffRole = s.createEmptyStaffRoleDraft({
    department: "",
    assignedWorkspace: String(e || s.sandboxCurrentWs || ""),
    projectId: String(t || s.sandboxCurrentProject || "")
  })), s.newSkillInput = "", s.enterprise3DScene && s.enterprise3DScene._isFullscreen ? s.showSandboxFloatPanel = !0 : s.showStaffRoleForm = !0);
}
async function Vu() {
  const e = J();
  if (e) {
    if (typeof e.sandboxGoBack == "function") {
      e.sandboxGoBack();
      return;
    }
    e.sandboxLevel = Math.max(0, Number(e.sandboxLevel || 0) - 1);
  }
}
async function Ou(e = {}) {
  const t = J();
  if (!t) return !1;
  const s = String(e?.id || "").trim(), i = {
    name: String(e?.name || "").trim(),
    description: String(e?.description || "").trim(),
    category: String(e?.category || "").trim()
  };
  if (typeof t.saveEnterpriseKnowledgeBaseRecord == "function")
    await t.saveEnterpriseKnowledgeBaseRecord({ ...i, ...s ? { id: s } : {} });
  else {
    if (kt())
      throw new Error("Desktop Enterprise host bridge is unavailable.");
    const a = s ? "PUT" : "POST", u = s ? `/v1/enterprise/knowledge-bases/${s}` : "/v1/enterprise/knowledge-bases", d = await fetch(u, {
      method: a,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(i)
    });
    if (!d.ok) {
      const p = await d.json().catch(() => ({}));
      throw new Error(p?.error || `Failed to save KB (${d.status})`);
    }
  }
  return typeof t.loadEnterpriseKBs == "function" && await t.loadEnterpriseKBs(), !0;
}
async function $u(e) {
  const t = J();
  if (!(!t || !e)) {
    if (typeof t.removeEnterpriseKnowledgeBaseRecord == "function")
      await t.removeEnterpriseKnowledgeBaseRecord(e);
    else {
      if (kt())
        throw new Error("Desktop Enterprise host bridge is unavailable.");
      const s = await fetch(`/v1/enterprise/knowledge-bases/${e}`, {
        method: "DELETE"
      });
      if (!s.ok) {
        const i = await s.json().catch(() => ({}));
        throw new Error(i?.error || `Failed to delete KB (${s.status})`);
      }
    }
    typeof t.loadEnterpriseKBs == "function" && await t.loadEnterpriseKBs();
  }
}
async function Fu(e) {
  if (!e) return [];
  const t = J();
  if (typeof t?.loadEnterpriseKnowledgeBaseVersionRecords == "function")
    return t.loadEnterpriseKnowledgeBaseVersionRecords(e);
  if (kt())
    throw new Error("Desktop Enterprise host bridge is unavailable.");
  const s = await fetch(`/v1/enterprise/knowledge-bases/${e}/versions`);
  if (!s.ok)
    throw new Error(`Failed to load versions (${s.status})`);
  const i = await s.json();
  return Array.isArray(i?.versions) ? i.versions : [];
}
function Nu() {
  return {
    snapshot: Yc,
    ensureLoaded: Hs,
    selectSurfaceTab: Gc,
    refreshSurface: Qc,
    runSystemUpdateCheck: Xc,
    openAboutSurface: Jc,
    updateSystemSetting: Zc,
    setSystemTargetLanguage: eu,
    clearSystemRuntimeCache: tu,
    runSystemQuickAction: nu,
    openSystemPath: su,
    resetSystemSettings: lu,
    loadFeaturePacks: fs,
    runFeaturePackOperation: Cc,
    startPrimaryDeployAction: ou,
    openTaskCenter: bu,
    openTask: xu,
    jumpToMenu: Su,
    // VRM actions
    startVrm: iu,
    startVrmWeb: au,
    setVrmModel: ru,
    downloadVrmModel: cu,
    toggleVrmMotion: uu,
    setVrmExpressionsEnabled: du,
    setVrmMotionsEnabled: pu,
    setVrmWindowWidth: fu,
    setVrmWindowHeight: vu,
    setVrmAgent: gu,
    openAddVrmModel: mu,
    openAddVrmMotion: _u,
    deleteVrmUserModel: hu,
    deleteVrmUserMotion: yu,
    openEnterpriseStaffRoleForm: yi,
    createEnterpriseStaffRoleFromTemplate: ku,
    deleteEnterpriseStaffRole: wu,
    openEnterpriseWorkspaceForm: Cu,
    openEnterpriseWorkspace: Mu,
    deleteEnterpriseWorkspace: Ru,
    openEnterpriseProjectForm: Tu,
    deleteEnterpriseProject: Eu,
    openEnterpriseProject: Pu,
    navigateEnterpriseSandbox: Au,
    openEnterpriseSandboxAgentChat: Du,
    openEnterpriseStaffRoleForProject: Iu,
    sandboxGoBack: Vu,
    saveEnterpriseKnowledgeBase: Ou,
    deleteEnterpriseKnowledgeBase: $u,
    loadEnterpriseKnowledgeBaseVersions: Fu,
    loadSynapxnetMemories: Ft,
    selectSynapxnetMemory: Ic,
    createSynapxnetMemory: Vc,
    editSynapxnetMemory: Oc,
    rollbackSynapxnetMemory: $c,
    retireSynapxnetMemory: Fc,
    exportSynapxnetMemories: Nc,
    importSynapxnetMemories: Lc,
    verifySynapxnetMemory: jc
  };
}
const Lu = { class: "ox-vite-ops-header" }, ju = { class: "ox-vite-ops-header__kicker" }, Bu = { class: "ox-vite-ops-header__actions" }, Wu = { class: "ox-vite-task-shell" }, Uu = { class: "ox-vite-task-board" }, Ku = { class: "ox-vite-task-column__head" }, Hu = {
  key: 0,
  class: "ox-vite-task-empty"
}, qu = ["onClick"], zu = { class: "ox-vite-task-card__title" }, Yu = { class: "ox-vite-task-card__summary" }, Gu = {
  key: 0,
  class: "ox-vite-task-progress"
}, Qu = { class: "ox-vite-task-card__meta" }, Xu = { class: "ox-vite-task-detail" }, Ju = { class: "ox-vite-task-detail__head" }, Zu = { class: "ox-vite-task-detail__title" }, ed = { class: "ox-vite-detail-chip" }, td = { class: "ox-vite-task-detail__summary" }, nd = { class: "ox-vite-task-detail__trace" }, sd = {
  key: 1,
  class: "ox-vite-empty-state"
}, ld = {
  key: 1,
  class: "ox-vite-about-shell"
}, od = { class: "ox-vite-about-name" }, id = { class: "ox-vite-detail-chip" }, ad = { class: "ox-vite-about-copy" }, rd = { class: "ox-vite-about-grid" }, cd = { class: "ox-vite-info-card__icon" }, ud = { class: "ox-vite-link-grid" }, dd = ["href"], pd = { class: "ox-vite-fact-list" }, fd = {
  key: 2,
  class: "ox-vite-vrm-layout"
}, vd = { class: "ox-vite-vrm-config" }, gd = { class: "ox-vite-vrm-topbar" }, md = { class: "ox-vite-vrm-topbar__title" }, _d = { class: "ox-vite-ops-header__kicker" }, hd = {
  key: 0,
  class: "ox-vite-vrm-guide"
}, yd = { class: "ox-vite-vrm-guide__note" }, bd = { class: "ox-vite-vrm-guide__steps" }, xd = { class: "ox-vite-vrm-guide__step-index" }, Sd = { class: "ox-vite-vrm-guide__step-copy" }, kd = {
  key: 0,
  class: "ox-vite-vrm-chips"
}, wd = {
  key: 1,
  class: "ox-vite-vrm-statgrid"
}, Cd = { class: "ox-vite-panel-card" }, Md = { class: "ox-vite-panel-card__head" }, Rd = { class: "ox-vite-vrm-tabs" }, Td = { class: "ox-vite-vrm-tab__count" }, Ed = { class: "ox-vite-vrm-tab__count" }, Pd = { class: "ox-vite-vrm-tab__count" }, Ad = { class: "ox-vite-vrm-search" }, Dd = ["placeholder"], Id = { class: "ox-vite-vrm-list" }, Vd = ["disabled", "onClick"], Od = { class: "ox-vite-vrm-row__icon" }, $d = { class: "ox-vite-vrm-row__main" }, Fd = { class: "ox-vite-vrm-row__name" }, Nd = { class: "ox-vite-vrm-row__sub" }, Ld = {
  key: 0,
  class: "fa-solid fa-circle-check ox-vite-vrm-row__check"
}, jd = ["onClick"], Bd = ["title", "onClick"], Wd = {
  key: 0,
  class: "ox-vite-vrm-empty"
}, Ud = { key: 0 }, Kd = { key: 1 }, Hd = { key: 2 }, qd = { key: 3 }, zd = { class: "ox-vite-panel-card" }, Yd = { class: "ox-vite-panel-card__head" }, Gd = { class: "ox-vite-form-grid" }, Qd = { class: "ox-vite-field" }, Xd = ["value"], Jd = ["value"], Zd = { class: "ox-vite-field" }, ep = { class: "ox-vite-vrm-toggle" }, tp = ["checked"], np = { class: "ox-vite-field" }, sp = { class: "ox-vite-vrm-toggle" }, lp = ["checked"], op = { class: "ox-vite-field" }, ip = ["value"], ap = { class: "ox-vite-field" }, rp = ["value"], cp = { class: "ox-vite-panel-card" }, up = { class: "ox-vite-panel-card__head" }, dp = { class: "ox-vite-vrm-tabs" }, pp = { class: "ox-vite-vrm-tab__count" }, fp = { class: "ox-vite-vrm-tab__count" }, vp = { class: "ox-vite-vrm-search" }, gp = ["placeholder"], mp = { class: "ox-vite-vrm-list" }, _p = ["onClick"], hp = { class: "ox-vite-vrm-row__icon" }, yp = { class: "ox-vite-vrm-row__main" }, bp = { class: "ox-vite-vrm-row__name" }, xp = { class: "ox-vite-vrm-row__sub" }, Sp = ["title", "onClick"], kp = {
  key: 0,
  class: "ox-vite-vrm-empty"
}, wp = { key: 0 }, Cp = { key: 1 }, Mp = { key: 2 }, Rp = { class: "ox-vite-vrm-preview" }, Tp = { class: "ox-vite-vrm-preview__head" }, Ep = { key: 0 }, Pp = { class: "ox-vite-vrm-preview__toggle" }, Ap = { class: "ox-vite-vrm-preview__stage" }, Dp = {
  key: 0,
  class: "ox-vite-vrm-preview__frame"
}, Ip = ["src"], Vp = {
  key: 1,
  class: "ox-vite-vrm-preview__frame"
}, Op = ["src"], $p = {
  key: 2,
  class: "ox-vite-vrm-preview__placeholder"
}, Fp = { class: "ox-vite-vrm-preview__actions ox-vite-vrm-preview__actions--top" }, Np = ["disabled"], Lp = {
  key: 0,
  class: "ox-vite-vrm-preview__motions"
}, jp = { class: "ox-vite-vrm-section-label" }, Bp = { class: "ox-vite-vrm-preview__motion-chips" }, Wp = { class: "ox-vite-vrm-preview__actions" }, Up = ["disabled"], Kp = { class: "ox-vite-ops-header" }, Hp = { class: "ox-vite-ops-header__kicker" }, qp = { class: "ox-vite-ops-header__actions" }, zp = {
  key: 0,
  class: "ox-vite-system-layout"
}, Yp = { class: "ox-vite-side-tabs" }, Gp = ["onClick"], Qp = { class: "ox-vite-ops-main" }, Xp = { class: "ox-vite-stat-grid" }, Jp = { class: "ox-vite-panel-card" }, Zp = { class: "ox-vite-panel-card__head" }, ef = {
  key: 0,
  class: "ox-vite-settings-stack"
}, tf = { class: "ox-vite-settings-section" }, nf = { class: "ox-vite-settings-section__label" }, sf = { class: "ox-vite-settings-row" }, lf = ["value"], of = ["value"], af = { class: "ox-vite-settings-row" }, rf = ["value"], cf = ["value"], uf = { class: "ox-vite-settings-row ox-vite-settings-row--wide" }, df = { class: "ox-vite-segmented" }, pf = ["onClick"], ff = { class: "ox-vite-settings-row ox-vite-settings-row--wide" }, vf = { class: "ox-vite-segmented" }, gf = ["onClick"], mf = { class: "ox-vite-settings-section" }, _f = { class: "ox-vite-settings-section__label" }, hf = { class: "ox-vite-settings-row" }, yf = { class: "ox-vite-switch" }, bf = ["checked"], xf = { class: "ox-vite-settings-row" }, Sf = { class: "ox-vite-switch" }, kf = ["checked"], wf = { class: "ox-vite-settings-section" }, Cf = { class: "ox-vite-settings-section__label" }, Mf = { class: "ox-vite-settings-row" }, Rf = {
  key: 1,
  class: "ox-vite-settings-stack"
}, Tf = { class: "ox-vite-settings-section" }, Ef = { class: "ox-vite-settings-section__label" }, Pf = { class: "ox-vite-theme-grid" }, Af = ["onClick"], Df = {
  key: 2,
  class: "ox-vite-settings-stack"
}, If = { class: "ox-vite-settings-section" }, Vf = { class: "ox-vite-settings-section__label" }, Of = { class: "ox-vite-shortcut-state" }, $f = { class: "ox-vite-settings-section" }, Ff = { class: "ox-vite-settings-section__label" }, Nf = ["onClick"], Lf = {
  key: 3,
  class: "ox-vite-settings-stack"
}, jf = { class: "ox-vite-settings-section" }, Bf = { class: "ox-vite-settings-section__label" }, Wf = { class: "ox-vite-settings-row" }, Uf = ["value"], Kf = ["value"], Hf = { class: "ox-vite-settings-row" }, qf = ["value"], zf = ["value"], Yf = {
  key: 0,
  class: "ox-vite-settings-row ox-vite-settings-row--wide"
}, Gf = ["value"], Qf = {
  key: 4,
  class: "ox-vite-feature-packs"
}, Xf = { class: "ox-vite-feature-packs__toolbar" }, Jf = { class: "ox-vite-feature-packs__feed" }, Zf = { key: 0 }, ev = ["disabled", "title"], tv = {
  key: 0,
  class: "ox-vite-feature-pack-notice is-error",
  role: "status"
}, nv = {
  key: 1,
  class: "ox-vite-feature-pack-notice",
  role: "status"
}, sv = {
  key: 2,
  class: "ox-vite-feature-pack-notice",
  role: "status"
}, lv = { class: "ox-vite-feature-pack-list" }, ov = { class: "ox-vite-feature-pack-row__identity" }, iv = { class: "ox-vite-feature-pack-row__icon" }, av = { class: "ox-vite-feature-pack-row__versions" }, rv = { class: "ox-vite-feature-pack-row__state" }, cv = {
  key: 0,
  class: "ox-vite-feature-pack-restart"
}, uv = { class: "ox-vite-feature-pack-row__actions" }, dv = ["disabled", "onClick"], pv = ["disabled", "onClick"], fv = ["disabled", "title", "onClick"], vv = { class: "ox-vite-feature-pack-progress__meta" }, gv = { key: 0 }, mv = { key: 1 }, _v = {
  class: "ox-vite-feature-pack-progress__track",
  "aria-hidden": "true"
}, hv = { key: 0 }, yv = {
  key: 5,
  class: "ox-vite-settings-stack"
}, bv = { class: "ox-vite-settings-section" }, xv = { class: "ox-vite-settings-section__label" }, Sv = { class: "ox-vite-settings-row" }, kv = { class: "ox-vite-settings-row" }, wv = { class: "ox-vite-settings-row" }, Cv = { class: "ox-vite-settings-section" }, Mv = { class: "ox-vite-settings-section__label" }, Rv = { class: "ox-vite-settings-row" }, Tv = { class: "ox-vite-settings-row" }, Ev = {
  key: 6,
  class: "ox-vite-card-grid"
}, Pv = { class: "ox-vite-panel-card" }, Av = { class: "ox-vite-panel-card__head" }, Dv = { class: "ox-vite-chip-grid" }, Iv = { class: "ox-vite-detail-chip" }, Vv = { class: "ox-vite-detail-chip" }, Ov = { class: "ox-vite-detail-chip" }, $v = { class: "ox-vite-fact-list" }, Fv = { class: "ox-vite-fact-row" }, Nv = { class: "ox-vite-fact-row" }, Lv = { class: "ox-vite-fact-row" }, jv = { class: "ox-vite-chip-grid" }, Bv = { class: "ox-vite-panel-card__head" }, Wv = { class: "ox-vite-chip-grid" }, Uv = { class: "ox-vite-detail-chip" }, Kv = { class: "ox-vite-bullet-list" }, Hv = { key: 1 }, qv = {
  key: 0,
  class: "ox-vite-side-tabs"
}, zv = ["onClick"], Yv = { class: "ox-vite-ops-main" }, Gv = {
  key: 0,
  class: "ox-vite-tab-strip"
}, Qv = ["onClick"], Xv = {
  key: 1,
  class: "ox-vite-summary-card"
}, Jv = { class: "ox-vite-chip-grid" }, Zv = {
  key: 2,
  class: "ox-vite-stat-grid"
}, eg = {
  key: 0,
  class: "ox-vite-card-grid"
}, tg = { class: "ox-vite-panel-card" }, ng = { class: "ox-vite-panel-card__head" }, sg = { class: "ox-vite-deploy-hero" }, lg = { class: "ox-vite-deploy-hero__status" }, og = { class: "ox-vite-deploy-kicker" }, ig = { class: "ox-vite-stat-card emphasis" }, ag = { class: "ox-vite-form-grid" }, rg = { class: "ox-vite-field" }, cg = ["value"], ug = { class: "ox-vite-field" }, dg = ["value"], pg = { class: "ox-vite-field" }, fg = ["value"], vg = { class: "ox-vite-field" }, gg = ["value"], mg = { class: "ox-vite-panel-card" }, _g = { class: "ox-vite-panel-card__head" }, hg = { class: "ox-vite-chip-grid" }, yg = { class: "ox-vite-detail-chip" }, bg = { class: "ox-vite-detail-chip" }, xg = { class: "ox-vite-detail-chip" }, Sg = {
  key: 1,
  class: "ox-vite-deploy-platform-grid"
}, kg = { class: "ox-vite-deploy-platform-card__head" }, wg = { class: "ox-vite-detail-chip" }, Cg = { class: "ox-vite-deploy-platform-card__meta" }, Mg = {
  key: 2,
  class: "ox-vite-card-grid"
}, Rg = { class: "ox-vite-panel-card" }, Tg = { class: "ox-vite-panel-card__head" }, Eg = { class: "ox-vite-deploy-platform-grid" }, Pg = { class: "ox-vite-deploy-platform-card__head" }, Ag = { class: "ox-vite-detail-chip" }, Dg = { class: "ox-vite-panel-card" }, Ig = { class: "ox-vite-panel-card__head" }, Vg = { class: "ox-vite-form-grid" }, Og = { class: "ox-vite-field" }, $g = ["value"], Fg = { class: "ox-vite-field" }, Ng = ["value"], Lg = { class: "ox-vite-field" }, jg = ["value"], Bg = { class: "ox-vite-field" }, Wg = ["value"], Ug = { class: "ox-vite-field ox-vite-field--wide" }, Kg = ["value"], Hg = {
  key: 3,
  class: "ox-vite-card-grid"
}, qg = { class: "ox-vite-panel-card" }, zg = { class: "ox-vite-panel-card__head" }, Yg = { class: "ox-vite-form-grid" }, Gg = { class: "ox-vite-field ox-vite-field--wide" }, Qg = ["value"], Xg = { class: "ox-vite-field" }, Jg = ["value"], Zg = { class: "ox-vite-field" }, em = ["value"], tm = { class: "ox-vite-chip-grid" }, nm = { class: "ox-vite-detail-chip" }, sm = { class: "ox-vite-panel-card" }, lm = { class: "ox-vite-panel-card__head" }, om = { class: "ox-vite-deploy-preview" }, im = {
  key: 4,
  class: "ox-vite-card-grid"
}, am = { class: "ox-vite-panel-card" }, rm = { class: "ox-vite-panel-card__head" }, cm = { class: "ox-vite-form-grid" }, um = { class: "ox-vite-field" }, dm = ["value"], pm = { class: "ox-vite-field" }, fm = ["value"], vm = { class: "ox-vite-chip-grid" }, gm = { class: "ox-vite-detail-chip" }, mm = { class: "ox-vite-detail-chip" }, _m = { class: "ox-vite-panel-card" }, hm = { class: "ox-vite-panel-card__head" }, ym = { class: "ox-vite-deploy-preview" }, bm = { class: "ox-vite-panel-card" }, xm = { class: "ox-vite-panel-card__head" }, Sm = { class: "ox-vite-deploy-preview" }, km = {
  key: 5,
  class: "ox-vite-card-grid"
}, wm = { class: "ox-vite-panel-card" }, Cm = { class: "ox-vite-panel-card__head" }, Mm = { class: "ox-vite-form-grid" }, Rm = { class: "ox-vite-field" }, Tm = ["value"], Em = { class: "ox-vite-field" }, Pm = ["value"], Am = { class: "ox-vite-field ox-vite-field--wide" }, Dm = ["value"], Im = { class: "ox-vite-field ox-vite-field--wide" }, Vm = ["value"], Om = { class: "ox-vite-field ox-vite-field--wide" }, $m = ["value"], Fm = { class: "ox-vite-stat-grid" }, Nm = { class: "ox-vite-summary-card" }, Lm = { class: "ox-vite-workbench-summary" }, jm = { class: "ox-vite-chip-grid" }, Bm = { class: "ox-vite-chip-grid" }, Wm = { class: "ox-vite-card-grid ox-vite-card-grid--workbench" }, Um = { class: "ox-vite-panel-card" }, Km = { class: "ox-vite-panel-card__head" }, Hm = { class: "ox-vite-chip-grid" }, qm = { class: "ox-vite-detail-chip" }, zm = { class: "ox-vite-detail-chip" }, Ym = { class: "ox-vite-detail-chip" }, Gm = { class: "ox-vite-form-grid" }, Qm = { class: "ox-vite-field" }, Xm = ["value"], Jm = { class: "ox-vite-field" }, Zm = ["value"], e_ = { class: "ox-vite-field ox-vite-field--wide" }, t_ = ["value"], n_ = {
  key: 0,
  class: "ox-vite-inline-note"
}, s_ = { class: "ox-vite-panel-card" }, l_ = { class: "ox-vite-panel-card__head" }, o_ = { class: "ox-vite-chip-grid" }, i_ = { class: "ox-vite-detail-chip" }, a_ = { class: "ox-vite-detail-chip" }, r_ = { class: "ox-vite-detail-chip" }, c_ = { class: "ox-vite-form-grid" }, u_ = { class: "ox-vite-field" }, d_ = ["value"], p_ = { class: "ox-vite-field" }, f_ = ["value"], v_ = { class: "ox-vite-field ox-vite-field--wide" }, g_ = ["value"], m_ = { class: "ox-vite-field ox-vite-field--wide" }, __ = ["value"], h_ = { class: "ox-vite-panel-card" }, y_ = { class: "ox-vite-panel-card__head" }, b_ = { class: "ox-vite-list" }, x_ = { class: "ox-vite-list-row" }, S_ = { class: "ox-vite-list-row" }, k_ = { class: "ox-vite-list-row" }, w_ = { class: "ox-vite-list-row" }, C_ = { class: "ox-vite-chip-grid" }, M_ = { class: "ox-vite-detail-chip" }, R_ = { class: "ox-vite-detail-chip" }, T_ = { class: "ox-vite-panel-card" }, E_ = { class: "ox-vite-panel-card__head" }, P_ = { class: "ox-vite-chip-grid" }, A_ = { class: "ox-vite-detail-chip" }, D_ = { class: "ox-vite-detail-chip" }, I_ = { class: "ox-vite-form-grid" }, V_ = { class: "ox-vite-field ox-vite-field--wide" }, O_ = ["value"], $_ = { class: "ox-vite-field" }, F_ = ["value"], N_ = { class: "ox-vite-field" }, L_ = ["value"], j_ = { class: "ox-vite-field" }, B_ = ["value"], W_ = {
  key: 0,
  class: "ox-vite-inline-note"
}, U_ = { class: "ox-vite-card-grid ox-vite-card-grid--workbench" }, K_ = { class: "ox-vite-panel-card" }, H_ = { class: "ox-vite-panel-card__head" }, q_ = { class: "ox-vite-list" }, z_ = { class: "ox-vite-detail-chip" }, Y_ = { class: "ox-vite-panel-card" }, G_ = { class: "ox-vite-panel-card__head" }, Q_ = { class: "ox-vite-list" }, X_ = { class: "ox-vite-detail-chip" }, J_ = {
  key: 0,
  class: "ox-vite-list-row"
}, Z_ = { class: "ox-vite-panel-card" }, eh = { class: "ox-vite-panel-card__head" }, th = { class: "ox-vite-list" }, nh = { class: "ox-vite-detail-chip" }, sh = {
  key: 0,
  class: "ox-vite-list-row"
}, lh = { class: "ox-vite-panel-card" }, oh = { class: "ox-vite-panel-card__head" }, ih = { class: "ox-vite-list" }, ah = {
  key: 0,
  class: "ox-vite-list-row"
}, rh = {
  key: 1,
  class: "ox-vite-card-grid"
}, ch = { class: "ox-vite-panel-card" }, uh = { class: "ox-vite-panel-card__head" }, dh = { class: "ox-vite-list" }, ph = { class: "ox-vite-stat-grid" }, fh = { class: "ox-vite-summary-card" }, vh = { class: "ox-vite-chip-grid" }, gh = { class: "ox-vite-stat-grid" }, mh = { class: "ox-vite-card-grid ox-vite-card-grid--workbench" }, _h = { class: "ox-vite-panel-card" }, hh = { class: "ox-vite-panel-card__head" }, yh = { class: "ox-vite-mini-bars" }, bh = { class: "ox-vite-panel-card" }, xh = { class: "ox-vite-panel-card__head" }, Sh = { class: "ox-vite-list" }, kh = { class: "ox-vite-panel-card" }, wh = { class: "ox-vite-panel-card__head" }, Ch = { class: "ox-vite-list" }, Mh = { class: "ox-vite-stat-grid" }, Rh = { class: "ox-vite-card-grid ox-vite-card-grid--workbench" }, Th = { class: "ox-vite-panel-card" }, Eh = { class: "ox-vite-panel-card__head" }, Ph = { class: "ox-vite-list" }, Ah = { class: "ox-vite-panel-card" }, Dh = { class: "ox-vite-panel-card__head" }, Ih = { class: "ox-vite-list" }, Vh = { class: "ox-vite-stat-grid" }, Oh = { class: "ox-vite-panel-card" }, $h = { class: "ox-vite-panel-card__head" }, Fh = { class: "ox-vite-list" }, Nh = {
  key: 0,
  class: "ox-vite-list-row"
}, Lh = {
  key: 3,
  class: "ox-vite-kb-hub"
}, jh = { class: "ox-vite-kb-hero" }, Bh = { class: "ox-vite-kb-hero__copy" }, Wh = { class: "ox-vite-ops-header__kicker" }, Uh = { class: "ox-vite-kb-hero__stats" }, Kh = { class: "ox-vite-role-hero__stat" }, Hh = { class: "ox-vite-role-hero__stat" }, qh = { class: "ox-vite-role-hero__stat" }, zh = { class: "ox-vite-role-toolbar" }, Yh = { class: "ox-vite-role-search" }, Gh = ["placeholder"], Qh = { class: "ox-vite-role-category-strip" }, Xh = ["onClick"], Jh = { class: "ox-vite-kb-layout" }, Zh = { class: "ox-vite-panel-card" }, ey = { class: "ox-vite-panel-card__head" }, ty = { class: "ox-vite-ops-header__kicker" }, ny = { class: "ox-vite-detail-chip" }, sy = {
  key: 0,
  class: "ox-vite-kb-grid"
}, ly = { class: "ox-vite-kb-card__head" }, oy = { class: "ox-vite-kb-card__identity" }, iy = { class: "ox-vite-kb-card__name" }, ay = { class: "ox-vite-kb-card__meta" }, ry = { class: "ox-vite-detail-chip" }, cy = { class: "ox-vite-chip-grid" }, uy = {
  key: 0,
  class: "ox-vite-detail-chip"
}, dy = { class: "ox-vite-workspace-card__actions" }, py = ["onClick"], fy = ["onClick"], vy = ["onClick"], gy = {
  key: 1,
  class: "ox-vite-empty-state"
}, my = { class: "ox-vite-panel-card ox-vite-kb-sidecard" }, _y = { class: "ox-vite-panel-card__head" }, hy = { class: "ox-vite-ops-header__kicker" }, yy = { class: "ox-vite-form-grid" }, by = { class: "ox-vite-field ox-vite-field--wide" }, xy = { class: "ox-vite-field ox-vite-field--wide" }, Sy = { class: "ox-vite-field ox-vite-field--wide" }, ky = { class: "ox-vite-workspace-card__actions" }, wy = ["disabled"], Cy = { class: "ox-vite-panel-card__head" }, My = { class: "ox-vite-ops-header__kicker" }, Ry = {
  key: 0,
  class: "ox-vite-list"
}, Ty = {
  key: 1,
  class: "ox-vite-empty-state ox-vite-empty-state--compact"
}, Ey = { class: "ox-vite-workspace-card__actions" }, Py = { class: "ox-vite-panel-card__head" }, Ay = { class: "ox-vite-ops-header__kicker" }, Dy = { class: "ox-vite-list" }, Iy = { class: "ox-vite-list-row" }, Vy = { class: "ox-vite-list-row" }, Oy = {
  key: 4,
  class: "ox-vite-role-studio"
}, $y = { class: "ox-vite-role-hero" }, Fy = { class: "ox-vite-role-hero__copy" }, Ny = { class: "ox-vite-ops-header__kicker" }, Ly = { class: "ox-vite-role-hero__stats" }, jy = { class: "ox-vite-role-hero__stat" }, By = { class: "ox-vite-role-hero__stat" }, Wy = { class: "ox-vite-role-hero__stat" }, Uy = { class: "ox-vite-role-toolbar" }, Ky = { class: "ox-vite-role-search" }, Hy = ["placeholder"], qy = { class: "ox-vite-role-category-strip" }, zy = ["onClick"], Yy = { class: "ox-vite-role-layout" }, Gy = { class: "ox-vite-panel-card" }, Qy = { class: "ox-vite-panel-card__head" }, Xy = { class: "ox-vite-ops-header__kicker" }, Jy = { class: "ox-vite-detail-chip" }, Zy = {
  key: 0,
  class: "ox-vite-role-template-grid"
}, eb = ["onClick"], tb = { class: "ox-vite-role-template-card__head" }, nb = { class: "ox-vite-role-template-card__icon" }, sb = { class: "ox-vite-role-template-card__category" }, lb = { class: "ox-vite-role-template-card__title" }, ob = { class: "ox-vite-role-template-card__department" }, ib = { class: "ox-vite-role-template-card__summary" }, ab = { class: "ox-vite-chip-grid" }, rb = { class: "ox-vite-role-template-card__foot" }, cb = {
  key: 1,
  class: "ox-vite-empty-state"
}, ub = { class: "ox-vite-panel-card ox-vite-role-spotlight" }, db = { class: "ox-vite-panel-card__head" }, pb = { class: "ox-vite-ops-header__kicker" }, fb = { class: "ox-vite-role-spotlight__list" }, vb = ["onClick"], gb = { class: "ox-vite-role-spotlight__icon" }, mb = { class: "ox-vite-role-spotlight__body" }, _b = { class: "ox-vite-role-spotlight__name" }, hb = { class: "ox-vite-role-spotlight__meta" }, yb = { class: "ox-vite-role-spotlight__tip" }, bb = { class: "ox-vite-panel-card" }, xb = { class: "ox-vite-panel-card__head" }, Sb = { class: "ox-vite-ops-header__kicker" }, kb = { class: "ox-vite-detail-chip" }, wb = {
  key: 0,
  class: "ox-vite-role-library-grid"
}, Cb = { class: "ox-vite-role-library-card__toolbar" }, Mb = ["onClick"], Rb = { class: "ox-vite-role-library-card__hero" }, Tb = { class: "ox-vite-role-library-card__icon" }, Eb = { class: "ox-vite-role-library-card__identity" }, Pb = { class: "ox-vite-role-library-card__name" }, Ab = { class: "ox-vite-role-library-card__meta" }, Db = { key: 0 }, Ib = { key: 1 }, Vb = { class: "ox-vite-role-library-card__summary" }, Ob = { class: "ox-vite-chip-grid" }, $b = {
  key: 1,
  class: "ox-vite-empty-state"
}, Fb = {
  key: 5,
  class: "ox-vite-workspace-hub"
}, Nb = { class: "ox-vite-workspace-hub__hero" }, Lb = { class: "ox-vite-workspace-hub__copy" }, jb = { class: "ox-vite-ops-header__kicker" }, Bb = { class: "ox-vite-workspace-hub__actions" }, Wb = {
  key: 0,
  class: "ox-vite-workspace-grid"
}, Ub = { class: "ox-vite-workspace-card__head" }, Kb = { class: "ox-vite-workspace-card__identity" }, Hb = { class: "ox-vite-workspace-card__copy" }, qb = { class: "ox-vite-workspace-card__name" }, zb = { class: "ox-vite-workspace-card__meta" }, Yb = { class: "ox-vite-detail-chip" }, Gb = { class: "ox-vite-workspace-card__stats" }, Qb = { class: "ox-vite-workspace-card__stat" }, Xb = { class: "ox-vite-workspace-card__stat" }, Jb = { class: "ox-vite-workspace-card__stat" }, Zb = { class: "ox-vite-chip-grid" }, e1 = { class: "ox-vite-detail-chip" }, t1 = {
  key: 0,
  class: "ox-vite-detail-chip"
}, n1 = { class: "ox-vite-workspace-card__actions" }, s1 = ["onClick"], l1 = ["onClick"], o1 = ["onClick"], i1 = {
  key: 1,
  class: "ox-vite-empty-state"
}, a1 = {
  key: 6,
  class: "ox-vite-sandbox-shell"
}, r1 = { class: "ox-vite-sandbox-hero" }, c1 = { class: "ox-vite-sandbox-hero__head" }, u1 = { class: "ox-vite-sandbox-hero__copy" }, d1 = { class: "ox-vite-ops-header__kicker" }, p1 = { class: "ox-vite-sandbox-breadcrumb" }, f1 = ["onClick"], v1 = { class: "ox-vite-stat-grid" }, g1 = { class: "ox-vite-stat-card" }, m1 = { class: "ox-vite-stat-card" }, _1 = { class: "ox-vite-stat-card" }, h1 = { class: "ox-vite-stat-card" }, y1 = { class: "ox-vite-sandbox-layout" }, b1 = { class: "ox-vite-panel-card" }, x1 = { class: "ox-vite-panel-card__head" }, S1 = { class: "ox-vite-ops-header__kicker" }, k1 = { class: "ox-vite-sandbox-workspace-shell" }, w1 = { class: "ox-vite-workspace-grid ox-vite-workspace-grid--compact" }, C1 = ["onClick"], M1 = { class: "ox-vite-workspace-card__head" }, R1 = { class: "ox-vite-workspace-card__identity" }, T1 = { class: "ox-vite-workspace-card__copy" }, E1 = { class: "ox-vite-workspace-card__name" }, P1 = { class: "ox-vite-workspace-card__meta" }, A1 = { class: "ox-vite-chip-grid" }, D1 = { class: "ox-vite-detail-chip" }, I1 = { class: "ox-vite-detail-chip" }, V1 = { class: "ox-vite-workspace-card__actions" }, O1 = ["onClick"], $1 = {
  key: 0,
  class: "ox-vite-sandbox-detail-card"
}, F1 = { class: "ox-vite-panel-card__head" }, N1 = { class: "ox-vite-ops-header__kicker" }, L1 = { class: "ox-vite-sandbox-detail-card__hero" }, j1 = { class: "ox-vite-sandbox-detail-card__title" }, B1 = { class: "ox-vite-sandbox-detail-card__meta" }, W1 = { class: "ox-vite-chip-grid" }, U1 = { class: "ox-vite-detail-chip" }, K1 = { class: "ox-vite-detail-chip" }, H1 = { class: "ox-vite-detail-chip" }, q1 = { class: "ox-vite-workspace-card__actions" }, z1 = { class: "ox-vite-panel-card" }, Y1 = { class: "ox-vite-panel-card__head" }, G1 = { class: "ox-vite-ops-header__kicker" }, Q1 = ["disabled"], X1 = {
  key: 0,
  class: "ox-vite-sandbox-project-shell"
}, J1 = { class: "ox-vite-role-template-grid" }, Z1 = ["onClick"], ex = { class: "ox-vite-project-card__head" }, tx = { class: "ox-vite-project-card__name" }, nx = { class: "ox-vite-project-card__meta" }, sx = { class: "ox-vite-chip-grid" }, lx = { class: "ox-vite-detail-chip" }, ox = {
  key: 0,
  class: "ox-vite-sandbox-detail-card"
}, ix = { class: "ox-vite-panel-card__head" }, ax = { class: "ox-vite-ops-header__kicker" }, rx = { class: "ox-vite-sandbox-detail-card__hero" }, cx = { class: "ox-vite-sandbox-detail-card__title" }, ux = { class: "ox-vite-sandbox-detail-card__meta" }, dx = { class: "ox-vite-sandbox-detail-card__summary" }, px = { class: "ox-vite-workspace-card__actions" }, fx = {
  key: 1,
  class: "ox-vite-empty-state"
}, vx = { class: "ox-vite-panel-card" }, gx = { class: "ox-vite-panel-card__head" }, mx = { class: "ox-vite-ops-header__kicker" }, _x = {
  key: 0,
  class: "ox-vite-sandbox-roster-shell"
}, hx = { class: "ox-vite-role-library-grid" }, yx = ["onClick"], bx = { class: "ox-vite-role-library-card__hero" }, xx = { class: "ox-vite-role-library-card__icon" }, Sx = { class: "ox-vite-role-library-card__identity" }, kx = { class: "ox-vite-role-library-card__name" }, wx = { class: "ox-vite-role-library-card__meta" }, Cx = { key: 0 }, Mx = { key: 1 }, Rx = { class: "ox-vite-chip-grid" }, Tx = { class: "ox-vite-detail-chip" }, Ex = {
  key: 0,
  class: "ox-vite-sandbox-detail-card"
}, Px = { class: "ox-vite-panel-card__head" }, Ax = { class: "ox-vite-ops-header__kicker" }, Dx = { class: "ox-vite-sandbox-detail-card__hero" }, Ix = { class: "ox-vite-role-library-card__icon ox-vite-role-library-card__icon--large" }, Vx = { class: "ox-vite-sandbox-detail-card__title" }, Ox = { class: "ox-vite-sandbox-detail-card__meta" }, $x = { key: 0 }, Fx = { class: "ox-vite-sandbox-detail-card__summary" }, Nx = { class: "ox-vite-chip-grid" }, Lx = { class: "ox-vite-detail-chip" }, jx = { class: "ox-vite-workspace-card__actions" }, Bx = {
  key: 1,
  class: "ox-vite-empty-state"
}, Wx = {
  key: 7,
  class: "ox-vite-media-grid"
}, Ux = { class: "ox-vite-chip-grid" }, Kx = { class: "ox-vite-detail-chip" }, Hx = { class: "ox-vite-chip-grid" }, qx = {
  key: 0,
  class: "ox-vite-memory-workbench"
}, zx = { class: "ox-vite-memory-toolbar" }, Yx = { class: "ox-vite-memory-actor" }, Gx = ["value"], Qx = { class: "ox-vite-memory-search" }, Xx = ["placeholder"], Jx = { class: "ox-vite-memory-check" }, Zx = { class: "ox-vite-memory-toolbar__actions" }, eS = ["title", "disabled"], tS = ["title", "disabled"], nS = ["disabled"], sS = {
  key: 0,
  class: "ox-vite-memory-notice is-error"
}, lS = { class: "ox-vite-memory-library" }, oS = { class: "ox-vite-memory-pane-head" }, iS = ["title"], aS = {
  key: 0,
  class: "ox-vite-memory-list"
}, rS = ["onClick"], cS = { class: "ox-vite-memory-row__head" }, uS = { class: "ox-vite-memory-row__badges" }, dS = ["data-memory-type"], pS = { class: "ox-vite-memory-row__meta" }, fS = {
  key: 1,
  class: "ox-vite-memory-empty"
}, vS = { class: "ox-vite-memory-inspector" }, gS = { class: "ox-vite-memory-pane-head" }, mS = ["title"], _S = { class: "ox-vite-memory-form" }, hS = {
  key: 0,
  class: "ox-vite-field"
}, yS = { class: "ox-vite-field ox-vite-field--wide" }, bS = { class: "ox-vite-field ox-vite-field--wide" }, xS = { class: "ox-vite-field" }, SS = ["placeholder"], kS = { class: "ox-vite-field" }, wS = ["placeholder"], CS = { class: "ox-vite-field" }, MS = {
  key: 1,
  class: "ox-vite-field ox-vite-field--wide"
}, RS = { class: "ox-vite-memory-actions" }, TS = ["disabled"], ES = { class: "ox-vite-memory-pane-head" }, PS = { class: "ox-vite-memory-header-actions" }, AS = ["title"], DS = ["title"], IS = { class: "ox-vite-memory-document" }, VS = { class: "ox-vite-memory-tags" }, OS = ["data-memory-type"], $S = { class: "ox-vite-memory-facts" }, FS = ["title"], NS = {
  key: 0,
  class: "ox-vite-memory-actions"
}, LS = {
  key: 2,
  class: "ox-vite-memory-empty"
}, jS = { class: "ox-vite-memory-history" }, BS = { class: "ox-vite-memory-pane-head" }, WS = {
  key: 0,
  class: "ox-vite-memory-version-list"
}, US = { class: "ox-vite-memory-version__body" }, KS = { class: "ox-vite-memory-version__head" }, HS = ["title"], qS = ["onClick"], zS = {
  key: 1,
  class: "ox-vite-memory-empty is-compact"
}, YS = {
  key: 1,
  class: "ox-vite-panel-card"
}, GS = { class: "ox-vite-list" }, QS = {
  key: 2,
  class: "ox-vite-media-grid"
}, XS = {
  key: 3,
  class: "ox-vite-media-grid"
}, JS = {
  key: 4,
  class: "ox-vite-panel-card"
}, ZS = { class: "ox-vite-list" }, ek = { class: "ox-vite-tab-strip" }, tk = ["onClick"], nk = { class: "ox-vite-stat-grid" }, sk = { class: "ox-vite-card-grid" }, lk = { class: "ox-vite-panel-card" }, ok = { class: "ox-vite-panel-card__head" }, ik = { class: "ox-vite-list" }, ak = { class: "ox-vite-panel-card" }, rk = { class: "ox-vite-panel-card__head" }, ck = { class: "ox-vite-list" }, uk = {
  __name: "App",
  props: {
    surface: {
      type: String,
      default: ""
    }
  },
  setup(e) {
    const t = e, s = Nu(), i = /* @__PURE__ */ me(s.snapshot(t.surface));
    let a = null, u = !1;
    function d() {
      const m = s.snapshot(t.surface), r = !u && m.isActive;
      i.value = m, r && s.ensureLoaded(t.surface).finally(() => {
        i.value = s.snapshot(t.surface);
      }), u = m.isActive;
    }
    function p(m) {
      s.selectSurfaceTab(t.surface, m).finally(d);
    }
    function g() {
      s.refreshSurface(t.surface).finally(d);
    }
    function S() {
      s.runSystemUpdateCheck().finally(d);
    }
    function b() {
      s.openAboutSurface().finally(d);
    }
    function w(m, r) {
      s.updateSystemSetting(m, r).finally(d);
    }
    function V(m, r) {
      w(m, r?.target?.value ?? r);
    }
    function L(m, r) {
      w(m, !!r?.target?.checked);
    }
    function Z(m) {
      s.setSystemTargetLanguage(m?.target?.value || "system").finally(d);
    }
    function W() {
      s.clearSystemRuntimeCache().finally(d);
    }
    function ae(m) {
      s.runSystemQuickAction(m).finally(d);
    }
    function F(m) {
      s.openSystemPath(m).finally(d);
    }
    function G() {
      s.resetSystemSettings().finally(d);
    }
    function ne() {
      s.loadFeaturePacks(!0).finally(d);
    }
    function U(m, r) {
      !r?.capabilityId || se(r) || m === "uninstall" && !window.confirm(
        c.value ? `确认卸载“${r.displayName}”？应用重启后该能力将不可用。` : `Uninstall “${r.displayName}”? This capability will be unavailable after restart.`
      ) || s.runFeaturePackOperation(m, r.capabilityId).catch(() => {
      }).finally(d);
    }
    function se(m) {
      const r = String(m?.progress?.phase || "");
      return !!m?.operation || !!r && r !== "completed" && r !== "failed";
    }
    function Ee(m) {
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
      })[m] || m;
    }
    function Pe(m) {
      return {
        "not-installed": "fa-regular fa-circle",
        installed: "fa-solid fa-circle-check",
        "update-available": "fa-solid fa-circle-arrow-up",
        damaged: "fa-solid fa-triangle-exclamation"
      }[m] || "fa-regular fa-circle-question";
    }
    function Ke(m) {
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
      })[m] || m;
    }
    function pt(m) {
      const r = Number(m);
      return !Number.isFinite(r) || r < 0 ? "" : r < 1024 ? `${r} B` : r < 1024 * 1024 ? `${(r / 1024).toFixed(1)} KB` : `${(r / (1024 * 1024)).toFixed(1)} MB`;
    }
    function K() {
      t.surface === "deploy" ? s.startPrimaryDeployAction().finally(d) : t.surface === "workbench" ? s.openTaskCenter().finally(d) : t.surface === "storage" ? i.value?.activeTab === "memory-v3" ? fl() : s.jumpToMenu("storage", "text").finally(d) : t.surface === "kernel" ? s.selectSurfaceTab("kernel", "actions").finally(d) : t.surface === "system" && (i.value?.activeTab === "about" ? s.runSystemUpdateCheck().finally(d) : s.selectSurfaceTab("system", "about").finally(d));
    }
    function we(m) {
      s.openTask(m).finally(d);
    }
    const He = /* @__PURE__ */ me(!1), x = /* @__PURE__ */ me("builtin"), B = /* @__PURE__ */ me(""), re = /* @__PURE__ */ me(""), he = /* @__PURE__ */ me("builtin"), ce = /* @__PURE__ */ me(""), ie = /* @__PURE__ */ me(""), st = /* @__PURE__ */ me("all"), ft = /* @__PURE__ */ me(""), lt = /* @__PURE__ */ me("all"), Ae = /* @__PURE__ */ me(!1), Nt = /* @__PURE__ */ me(!1), vt = /* @__PURE__ */ me("summary"), Ht = /* @__PURE__ */ me([]), Me = /* @__PURE__ */ me({
      id: "",
      name: "",
      description: "",
      category: ""
    }), Oe = /* @__PURE__ */ me(""), Re = /* @__PURE__ */ me(""), Ge = /* @__PURE__ */ me(""), ot = /* @__PURE__ */ me(""), Zt = /* @__PURE__ */ me(""), _ = /* @__PURE__ */ me(!1), y = /* @__PURE__ */ me(!1), k = /* @__PURE__ */ me("create"), R = /* @__PURE__ */ me(!1), M = /* @__PURE__ */ me(""), C = /* @__PURE__ */ me({
      memoryId: "",
      baseVersion: 0,
      taskId: "",
      title: "",
      content: "",
      qualityScore: 0.8,
      permissionsText: "",
      tagsText: "",
      reason: ""
    });
    function N() {
      s.startVrm().finally(d);
    }
    function O() {
      s.startVrmWeb().finally(d);
    }
    function A(m) {
      const r = typeof m == "object" && m ? m : { id: m };
      if (r.cloud && !r.downloaded) {
        E(r);
        return;
      }
      s.setVrmModel(r.id).finally(d);
    }
    function E(m, r) {
      r && r.stopPropagation(), !(!m?.id || re.value) && (re.value = m.id, s.downloadVrmModel(m.id).catch(() => {
      }).finally(() => {
        re.value = "", d();
      }));
    }
    function Y(m, r) {
      r && r.stopPropagation(), s.deleteVrmUserModel(m).finally(d);
    }
    function j(m) {
      s.toggleVrmMotion(m).finally(d);
    }
    function H(m, r) {
      r && r.stopPropagation(), s.deleteVrmUserMotion(m).finally(d);
    }
    function Q(m) {
      s.setVrmExpressionsEnabled(m.target.checked).finally(d);
    }
    function le(m) {
      s.setVrmMotionsEnabled(m.target.checked).finally(d);
    }
    function pe(m) {
      s.setVrmWindowWidth(m.target.value).finally(d);
    }
    function ve(m) {
      s.setVrmWindowHeight(m.target.value).finally(d);
    }
    function Se(m) {
      s.setVrmAgent(m.target.value).finally(d);
    }
    function Ce() {
      s.openAddVrmModel().finally(d);
    }
    function Ze() {
      s.openAddVrmMotion().finally(d);
    }
    function qe() {
      s.openEnterpriseStaffRoleForm().finally(d);
    }
    function Lt(m) {
      s.createEnterpriseStaffRoleFromTemplate(m).finally(d);
    }
    function fn(m) {
      s.deleteEnterpriseStaffRole(m).finally(d);
    }
    function De() {
      s.openEnterpriseWorkspaceForm().finally(d);
    }
    function Qe(m) {
      Oe.value = String(m || ""), s.openEnterpriseWorkspaceForm(m).finally(d);
    }
    function en(m) {
      Oe.value = String(m || ""), s.openEnterpriseWorkspace(m).finally(d);
    }
    function jn(m) {
      Oe.value === String(m || "") && (Oe.value = ""), s.deleteEnterpriseWorkspace(m).finally(d);
    }
    function dl(m) {
      s.openEnterpriseProjectForm(m).finally(d);
    }
    function bi(m, r = "") {
      Re.value = String(m || ""), s.openEnterpriseProjectForm(r, m).finally(d);
    }
    function xi(m) {
      const r = String(m || "");
      Re.value === r && (Re.value = ""), s.deleteEnterpriseProject(m).finally(d);
    }
    function Si() {
      Oe.value = "", Re.value = "", Ge.value = "", s.sandboxGoBack().finally(d);
    }
    function ki(m) {
      const r = Number(m?.level || 0);
      r <= 0 ? (Oe.value = "", Re.value = "", Ge.value = "") : r === 1 ? (Oe.value = String(m?.id || ""), Re.value = "", Ge.value = "") : r === 2 && (Re.value = String(m?.id || "")), s.navigateEnterpriseSandbox(r, m?.id || "").finally(d);
    }
    function wi(m) {
      Re.value = String(m || ""), s.openEnterpriseProject(m).finally(d);
    }
    function Ci(m) {
      Re.value = String(m || "");
    }
    function Mi(m) {
      Ge.value = String(m || "");
    }
    function Ri(m) {
      Ge.value = String(m || ""), s.openEnterpriseSandboxAgentChat(m).finally(d);
    }
    function Ti(m) {
      Ge.value = String(m || ""), s.openEnterpriseStaffRoleForm(m).finally(d);
    }
    function Ei() {
      s.openEnterpriseStaffRoleForProject(
        be.value.currentWorkspaceId,
        be.value.currentProjectId || Re.value
      ).finally(d);
    }
    function Pi() {
      Me.value = {
        id: "",
        name: "",
        description: "",
        category: xs.value[1]?.id || "general"
      }, Nt.value = !1, vt.value = "editor", Ae.value = !0;
    }
    function Ai(m) {
      Me.value = {
        id: m?.id || "",
        name: m?.name || "",
        description: m?.description || "",
        category: m?.category || ""
      }, Nt.value = !1, vt.value = "editor", Ae.value = !0;
    }
    async function Di() {
      try {
        await s.saveEnterpriseKnowledgeBase(Me.value), Ae.value = !1, vt.value = "summary", d();
      } catch (m) {
        console.error(m);
      }
    }
    function Ii(m) {
      s.deleteEnterpriseKnowledgeBase(m?.id).then(d).catch((r) => {
        console.error(r);
      });
    }
    function pl(m) {
      return [...new Set(String(m || "").split(/[,，\n]/).map((r) => r.trim()).filter(Boolean))];
    }
    function fl() {
      k.value = "create", M.value = "", C.value = {
        memoryId: "",
        baseVersion: 0,
        taskId: "",
        title: "",
        content: "",
        qualityScore: 0.8,
        permissionsText: "",
        tagsText: "",
        reason: ""
      }, y.value = !0;
    }
    function Vi() {
      const m = h.value.memoryV3?.selectedMemory;
      m && (k.value = "edit", M.value = "", C.value = {
        memoryId: String(m.memoryId || ""),
        baseVersion: Number(m.version || 0),
        taskId: String(m.taskId || ""),
        title: String(m.title || ""),
        content: String(m.content || ""),
        qualityScore: Number(m.qualityScore ?? 0.8),
        permissionsText: (m.permissions || []).join(", "),
        tagsText: (m.tags || []).join(", "),
        reason: ""
      }, y.value = !0);
    }
    async function Oi() {
      const m = C.value;
      if (!(!String(m.title || "").trim() || !String(m.content || "").trim()) && !(k.value === "create" && !String(m.taskId || "").trim())) {
        R.value = !0, M.value = "";
        try {
          const r = {
            ...m,
            qualityScore: Number(m.qualityScore ?? 0.8),
            permissions: pl(m.permissionsText),
            tags: pl(m.tagsText)
          };
          k.value === "edit" ? await s.editSynapxnetMemory(r) : await s.createSynapxnetMemory(r), y.value = !1, d();
        } catch (r) {
          M.value = String(r?.message || "Memory operation failed.");
        } finally {
          R.value = !1;
        }
      }
    }
    async function Bn() {
      R.value = !0, M.value = "";
      try {
        await s.loadSynapxnetMemories({
          actorAgent: Zt.value,
          query: ot.value,
          includeRetired: _.value
        }), d();
      } catch (m) {
        M.value = String(m?.message || "Memory list could not be loaded.");
      } finally {
        R.value = !1;
      }
    }
    async function $i(m) {
      M.value = "";
      try {
        await s.selectSynapxnetMemory(m), d();
      } catch (r) {
        M.value = String(r?.message || "Memory history could not be loaded.");
      }
    }
    async function Fi(m) {
      const r = h.value.memoryV3?.selectedMemory;
      if (!(!r || Number(m?.version) === Number(r.version) || !window.confirm(
        c.value ? `确认从 v${m.version} 创建一个新的回滚版本？历史版本不会被覆盖。` : `Create a new rollback version from v${m.version}? Existing history will remain unchanged.`
      ))) {
        R.value = !0;
        try {
          await s.rollbackSynapxnetMemory(r.memoryId, m.version, c.value ? "用户从版本时间线回滚" : "User rollback from version timeline"), d();
        } catch (P) {
          M.value = String(P?.message || "Rollback failed.");
        } finally {
          R.value = !1;
        }
      }
    }
    async function Ni() {
      const m = h.value.memoryV3?.selectedMemory;
      if (!(!m || !window.confirm(c.value ? "确认退役当前记忆？历史版本仍会保留。" : "Retire this memory? Its version history will be preserved."))) {
        R.value = !0;
        try {
          await s.retireSynapxnetMemory(m.memoryId), d();
        } catch (l) {
          M.value = String(l?.message || "Retire failed.");
        } finally {
          R.value = !1;
        }
      }
    }
    async function Li() {
      R.value = !0;
      try {
        await s.verifySynapxnetMemory(""), d();
      } catch (m) {
        M.value = String(m?.message || "Integrity verification failed.");
      } finally {
        R.value = !1;
      }
    }
    async function ji() {
      const m = h.value.memoryV3?.selectedMemory;
      if (m) {
        R.value = !0;
        try {
          const r = await s.exportSynapxnetMemories([m.memoryId]), l = new Blob([JSON.stringify(r, null, 2)], { type: "application/json;charset=utf-8" }), P = URL.createObjectURL(l), it = window.document.createElement("a");
          it.href = P, it.download = `openxnet-memory-${m.memoryId.slice(0, 12)}.json`, it.click(), URL.revokeObjectURL(P);
        } catch (r) {
          M.value = String(r?.message || "Memory export failed.");
        } finally {
          R.value = !1;
        }
      }
    }
    function Bi() {
      const m = window.document.createElement("input");
      m.type = "file", m.accept = ".json,application/json", m.addEventListener("change", async () => {
        const r = m.files?.[0];
        if (r) {
          R.value = !0;
          try {
            const l = JSON.parse(await r.text());
            await s.importSynapxnetMemories(l), d();
          } catch (l) {
            M.value = String(l?.message || "Memory import failed.");
          } finally {
            R.value = !1;
          }
        }
      }, { once: !0 }), m.click();
    }
    function vl(m) {
      return m ? new Date(m).toLocaleString() : "--";
    }
    function gl(m) {
      const r = String(m || "");
      return r ? `${r.slice(0, 8)}...${r.slice(-6)}` : "--";
    }
    function ml(m) {
      const r = {
        skill: c.value ? "技能记忆" : "Skill",
        incident: c.value ? "事件记忆" : "Incident",
        collaboration: c.value ? "协作记忆" : "Collaboration",
        decision: c.value ? "决策记忆" : "Decision",
        manual: c.value ? "人工记忆" : "Manual"
      };
      return r[String(m || "manual")] || r.manual;
    }
    function _l(m) {
      return {
        skill: "fa-solid fa-wand-magic-sparkles",
        incident: "fa-solid fa-circle-nodes",
        collaboration: "fa-solid fa-people-group",
        decision: "fa-solid fa-code-branch",
        manual: "fa-solid fa-pen-to-square"
      }[String(m || "manual")] || "fa-solid fa-pen-to-square";
    }
    function Wi(m) {
      const r = {
        competition: c.value ? "比赛闭环" : "Competition",
        "goai-staging": c.value ? "复赛验证环境" : "GOAI staging",
        "resolved-incident": c.value ? "已验证事件" : "Verified incident",
        "recommendation-capacity": c.value ? "推荐容量治理" : "Recommendation capacity",
        "quantitative-iteration": c.value ? "量化模型迭代" : "Quantitative iteration",
        "feature-drift": c.value ? "跨域特征漂移" : "Feature drift"
      };
      return (m?.tags || []).filter((l) => !String(l).startsWith("memory-type:")).map((l) => ({ key: String(l), label: r[String(l)] || String(l) }));
    }
    function Ui(m) {
      const r = m?.integrity;
      if (!r?.healthy)
        return c.value ? "完整性校验发现异常" : "Integrity verification found problems";
      const l = m?.recovery;
      return l?.source === "bundled-transfer" && Number(l.importedVersions || 0) > 0 ? c.value ? `已恢复 ${l.importedVersions} 个可信版本，记录链与审计链完整` : `${l.importedVersions} trusted versions restored; record and audit chains are healthy` : l?.source === "competition-history" && Number(l.reconciledMemories || 0) > 0 ? c.value ? `已补投影 ${l.reconciledMemories} 条成功闭环，记录链与审计链完整` : `${l.reconciledMemories} resolved workflows reconciled; record and audit chains are healthy` : c.value ? `已校验 ${r.checkedVersions} 个版本，记录链与审计链完整` : `${r.checkedVersions} versions verified; record and audit chains are healthy`;
    }
    async function Ki(m) {
      Ae.value = !1, vt.value = "versions", Nt.value = !0, Ht.value = [];
      try {
        Ht.value = await s.loadEnterpriseKnowledgeBaseVersions(m?.id);
      } catch (r) {
        console.error(r), Ht.value = [];
      }
    }
    const h = fe(() => i.value || {}), c = fe(() => h.value.isZh), $e = fe(() => h.value.featurePacks || {}), te = fe(() => h.value.vrm || {}), Wn = fe(() => (te.value.motions || []).filter((m) => m.selected)), vn = fe(() => h.value.rolePanel || {}), gn = fe(() => vn.value.items || []), qt = fe(() => vn.value.templates || []), hl = fe(() => h.value.workspacePanel || {}), be = fe(() => h.value.sandboxPanel || {}), zt = fe(() => h.value.knowledgePanel || {}), oe = fe(() => h.value.memoryV3 || {}), gs = fe(() => {
      const m = oe.value.selectedMemory;
      return !!m && String(m.ownerAgent || "") === String(oe.value.actorAgent || "");
    }), Hi = fe(() => {
      const m = /* @__PURE__ */ new Set(), r = [];
      return qt.value.forEach((l) => {
        const P = String(l?.category || "").trim();
        !P || m.has(P) || (m.add(P), r.push({
          id: P,
          label: String(l?.categoryLabel || P)
        }));
      }), [
        {
          id: "all",
          label: c.value ? "全部岗位" : "All Roles"
        },
        ...r
      ];
    }), ms = fe(() => {
      const m = String(st.value || "all").trim(), r = String(ie.value || "").trim().toLowerCase();
      return qt.value.filter((l) => m !== "all" && String(l?.category || "").trim() !== m ? !1 : r ? [
        l?.name,
        l?.department,
        l?.summary,
        l?.categoryLabel,
        ...l?.skills || []
      ].filter(Boolean).join(" ").toLowerCase().includes(r) : !0);
    }), qi = fe(() => {
      const m = qt.value.filter((r) => r?.featured);
      return (m.length ? m : qt.value).slice(0, 4);
    }), yl = fe(() => te.value.defaultModels || []), _s = fe(() => te.value.cloudModels || []), hs = fe(() => te.value.userModels || []), bl = fe(() => {
      const m = x.value === "custom" ? hs.value : x.value === "cloud" ? _s.value : yl.value, r = String(B.value || "").trim().toLowerCase();
      return r ? m.filter((l) => [l.name, l.id, l.relativePath].filter(Boolean).join(" ").toLowerCase().includes(r)) : m;
    }), xl = fe(() => (te.value.motions || []).filter((m) => m.builtin)), ys = fe(() => (te.value.motions || []).filter((m) => !m.builtin)), Sl = fe(() => {
      const m = he.value === "custom" ? ys.value : xl.value, r = String(ce.value || "").trim().toLowerCase();
      return r ? m.filter((l) => String(l.name || l.id || "").toLowerCase().includes(r)) : m;
    });
    function zi(m) {
      return String(m || "all") === "all" ? qt.value.length : qt.value.filter((r) => String(r?.category || "") === String(m || "")).length;
    }
    function bs(m) {
      const r = Array.isArray(m?.accent) && m.accent.length ? m.accent : ["#4ecdc4", "#5b8cff"];
      return {
        "--ox-vite-role-accent-start": r[0],
        "--ox-vite-role-accent-end": r[1] || r[0]
      };
    }
    function kl(m) {
      const r = String(m || "default");
      return c.value ? {
        default: "默认权限",
        readonly: "只读",
        write: "读写",
        admin: "管理"
      }[r] || r : {
        default: "Default",
        readonly: "Read only",
        write: "Read / Write",
        admin: "Admin"
      }[r] || r;
    }
    function wl(m) {
      const r = String(m || "").trim().toLowerCase();
      return c.value ? {
        online: "在线",
        idle: "待命",
        busy: "执行中",
        running: "运行中",
        offline: "离线",
        unknown: "未知"
      }[r] || m || "未知" : {
        online: "Online",
        idle: "Idle",
        busy: "Busy",
        running: "Running",
        offline: "Offline",
        unknown: "Unknown"
      }[r] || m || "Unknown";
    }
    const xs = fe(() => {
      const m = /* @__PURE__ */ new Set(), r = [];
      return (zt.value.items || []).forEach((l) => {
        const P = String(l?.category || "").trim();
        !P || m.has(P) || (m.add(P), r.push({ id: P, label: P }));
      }), [
        {
          id: "all",
          label: c.value ? "全部知识库" : "All KBs"
        },
        ...r
      ];
    }), Ss = fe(() => {
      const m = String(lt.value || "all").trim(), r = String(ft.value || "").trim().toLowerCase();
      return (zt.value.items || []).filter((l) => m !== "all" && String(l?.category || "") !== m ? !1 : r ? [l?.name, l?.category, l?.description].filter(Boolean).join(" ").toLowerCase().includes(r) : !0);
    }), ze = fe(() => {
      const m = be.value.projects || [];
      return m.find((l) => String(l?.id || "") === String(Re.value || "")) || m[0] || null;
    }), Ie = fe(() => {
      const m = be.value.items || [];
      return m.find((l) => String(l?.id || "") === String(Ge.value || "")) || m[0] || null;
    }), Xe = fe(() => {
      const m = be.value.workspaces || [], r = String(Oe.value || be.value.currentWorkspaceId || "");
      return m.find((P) => String(P?.id || "") === r) || m[0] || null;
    });
    return kn(
      be,
      (m) => {
        const r = String(m?.currentWorkspaceId || "").trim(), l = String(m?.currentProjectId || "").trim(), P = String(m?.selectedAgentId || "").trim();
        r ? Oe.value = r : (m?.workspaces || []).some((it) => String(it?.id || "") === String(Oe.value || "")) || (Oe.value = ""), l ? Re.value = l : (m?.projects || []).some((it) => String(it?.id || "") === String(Re.value || "")) || (Re.value = ""), P ? Ge.value = P : (m?.items || []).some((it) => String(it?.id || "") === String(Ge.value || "")) || (Ge.value = "");
      },
      { deep: !0 }
    ), kn(
      oe,
      (m) => {
        Zt.value || (Zt.value = String(m?.actorAgent || "")), !ot.value && m?.query && (ot.value = String(m.query)), _.value = !!m?.includeRetired;
      },
      { deep: !0, immediate: !0 }
    ), Wo(() => {
      d(), a = window.setInterval(d, 800);
    }), Uo(() => {
      a && (window.clearInterval(a), a = null);
    }), (m, r) => (f(), v("div", {
      class: $(["ox-vite-ops-shell", `surface-${t.surface}`])
    }, [
      t.surface === "task" ? (f(), v(T, { key: 0 }, [
        n("div", Lu, [
          n("div", null, [
            n("div", ju, o((c.value, "Task Board")), 1),
            n("h1", null, o(h.value.title), 1),
            n("p", null, o(h.value.subtitle), 1)
          ]),
          n("div", Bu, [
            n("button", {
              type: "button",
              class: "ox-vite-ops-secondary-btn",
              onClick: g
            }, [
              r[51] || (r[51] = n("i", { class: "fa-solid fa-rotate-right" }, null, -1)),
              n("span", null, o(c.value ? "刷新" : "Refresh"), 1)
            ])
          ])
        ]),
        n("div", Wu, [
          n("section", Uu, [
            (f(!0), v(T, null, D(h.value.columns || [], (l) => (f(), v("article", {
              key: l.id,
              class: "ox-vite-task-column"
            }, [
              n("div", Ku, [
                n("h2", null, o(l.title), 1),
                n("span", null, o((l.tasks || []).length), 1)
              ]),
              (l.tasks || []).length ? q("", !0) : (f(), v("div", Hu, [
                n("strong", null, o(l.emptyTitle), 1),
                n("p", null, o(l.emptyCopy), 1)
              ])),
              (f(!0), v(T, null, D(l.tasks || [], (P) => (f(), v("button", {
                key: P.id,
                type: "button",
                class: $(["ox-vite-task-card", `is-${P.status || "pending"}`]),
                onClick: (it) => we(P.raw)
              }, [
                n("div", zu, o(P.title), 1),
                n("div", Yu, o(P.summary), 1),
                P.progress !== null ? (f(), v("div", Gu, [
                  n("div", {
                    class: "ox-vite-task-progress__fill",
                    style: rt({ width: `${Math.max(0, Math.min(100, P.progress))}%` })
                  }, null, 4)
                ])) : q("", !0),
                n("div", Qu, [
                  n("span", null, o(P.assignee || (c.value ? "未分配" : "Unassigned")), 1),
                  n("span", null, o(P.updatedAt), 1)
                ])
              ], 10, qu))), 128))
            ]))), 128))
          ]),
          n("aside", Xu, [
            n("div", Ju, [
              n("h2", null, o(c.value ? "任务详情" : "Task Detail"), 1)
            ]),
            h.value.detail ? (f(), v(T, { key: 0 }, [
              n("div", Zu, o(h.value.detail.title), 1),
              n("div", ed, o(h.value.detail.status || (c.value ? "待处理" : "Pending")), 1),
              n("p", td, o(h.value.detail.summary), 1),
              n("div", nd, [
                (f(!0), v(T, null, D(h.value.detail.trace || [], (l) => (f(), v("div", {
                  key: l.id,
                  class: "ox-vite-task-detail__trace-item"
                }, o(l.text), 1))), 128))
              ])
            ], 64)) : (f(), v("div", sd, [
              r[52] || (r[52] = n("i", { class: "fa-solid fa-list-check" }, null, -1)),
              n("strong", null, o(c.value ? "选择一个任务查看详情" : "Select a task to inspect"), 1)
            ]))
          ])
        ])
      ], 64)) : t.surface === "about" ? (f(), v("div", ld, [
        r[53] || (r[53] = n("div", { class: "ox-vite-about-mark" }, [
          n("img", {
            src: "/source/icon.png",
            alt: "OpenXnet"
          })
        ], -1)),
        n("div", od, o(h.value.title), 1),
        n("div", id, "v" + o(h.value.version), 1),
        n("p", ad, o(h.value.subtitle), 1),
        n("section", rd, [
          (f(!0), v(T, null, D(h.value.features || [], (l) => (f(), v("article", {
            key: l.title,
            class: "ox-vite-info-card"
          }, [
            n("div", cd, [
              n("i", {
                class: $(l.icon)
              }, null, 2)
            ]),
            n("div", null, [
              n("h3", null, o(l.title), 1),
              n("p", null, o(l.description), 1)
            ])
          ]))), 128))
        ]),
        n("section", ud, [
          (f(!0), v(T, null, D(h.value.links || [], (l) => (f(), v("a", {
            key: l.href,
            class: "ox-vite-link-card",
            href: l.href,
            target: "_blank",
            rel: "noreferrer"
          }, [
            n("span", null, o(l.label), 1),
            n("strong", null, o(l.value), 1)
          ], 8, dd))), 128))
        ]),
        n("section", pd, [
          (f(!0), v(T, null, D(h.value.facts || [], (l) => (f(), v("article", {
            key: l.label,
            class: "ox-vite-fact-row"
          }, [
            n("span", null, o(l.label), 1),
            n("p", null, o(l.value), 1)
          ]))), 128))
        ])
      ])) : t.surface === "vrm" ? (f(), v("div", fd, [
        n("div", vd, [
          n("header", gd, [
            n("div", md, [
              n("div", _d, o(c.value ? "VRM 桌宠" : "VRM Pet"), 1),
              n("h1", null, o(h.value.title), 1),
              n("p", null, o(h.value.subtitle), 1),
              h.value.meta?.setupSteps?.length ? (f(), v("div", hd, [
                n("div", yd, [
                  r[54] || (r[54] = n("i", { class: "fa-solid fa-route" }, null, -1)),
                  n("span", null, o(h.value.meta?.guideNote), 1)
                ]),
                n("div", bd, [
                  (f(!0), v(T, null, D(h.value.meta?.setupSteps || [], (l, P) => (f(), v("span", {
                    key: l.title,
                    class: "ox-vite-vrm-guide__step"
                  }, [
                    n("span", xd, o(P + 1), 1),
                    n("i", {
                      class: $(l.icon)
                    }, null, 2),
                    n("span", Sd, [
                      n("strong", null, o(l.title), 1),
                      n("small", null, o(l.desc), 1)
                    ])
                  ]))), 128))
                ])
              ])) : q("", !0)
            ])
          ]),
          h.value.meta?.chips?.length ? (f(), v("section", kd, [
            (f(!0), v(T, null, D(h.value.meta.chips || [], (l) => (f(), v("span", {
              key: l.icon + l.text,
              class: "ox-vite-detail-chip"
            }, [
              n("i", {
                class: $(l.icon)
              }, null, 2),
              n("span", null, o(l.text), 1)
            ]))), 128))
          ])) : q("", !0),
          h.value.stats?.length ? (f(), v("section", wd, [
            (f(!0), v(T, null, D(h.value.stats, (l) => (f(), v("article", {
              key: l.label,
              class: $(["ox-vite-stat-card", { emphasis: l.emphasis }])
            }, [
              n("span", null, o(l.label), 1),
              n("strong", null, o(l.value), 1),
              n("small", null, o(l.meta), 1)
            ], 2))), 128))
          ])) : q("", !0),
          n("article", Cd, [
            n("div", Md, [
              n("div", null, [
                n("h2", null, o(c.value ? "VRM 模型" : "VRM Model"), 1),
                n("p", null, o(c.value ? "内置和自定义模型分开管理，搜索过滤后从列表中点选。" : "Built-in and custom models are split. Search to filter, click to select."), 1)
              ]),
              n("button", {
                type: "button",
                class: "ox-vite-ops-secondary-btn",
                onClick: Ce
              }, [
                r[55] || (r[55] = n("i", { class: "fa-solid fa-plus" }, null, -1)),
                n("span", null, o(c.value ? "上传模型" : "Upload"), 1)
              ])
            ]),
            n("div", Rd, [
              n("button", {
                type: "button",
                class: $(["ox-vite-vrm-tab", { "is-active": x.value === "builtin" }]),
                onClick: r[0] || (r[0] = (l) => x.value = "builtin")
              }, [
                r[56] || (r[56] = n("i", { class: "fa-solid fa-star" }, null, -1)),
                n("span", null, o(c.value ? "内置模型" : "Built-in"), 1),
                n("span", Td, o(yl.value.length), 1)
              ], 2),
              n("button", {
                type: "button",
                class: $(["ox-vite-vrm-tab", { "is-active": x.value === "cloud" }]),
                onClick: r[1] || (r[1] = (l) => x.value = "cloud")
              }, [
                r[57] || (r[57] = n("i", { class: "fa-solid fa-cloud-arrow-down" }, null, -1)),
                n("span", null, o(c.value ? "资源库" : "Library"), 1),
                n("span", Ed, o(_s.value.length), 1)
              ], 2),
              n("button", {
                type: "button",
                class: $(["ox-vite-vrm-tab", { "is-active": x.value === "custom" }]),
                onClick: r[2] || (r[2] = (l) => x.value = "custom")
              }, [
                r[58] || (r[58] = n("i", { class: "fa-solid fa-user" }, null, -1)),
                n("span", null, o(c.value ? "自定义" : "Custom"), 1),
                n("span", Pd, o(hs.value.length), 1)
              ], 2)
            ]),
            n("div", Ad, [
              r[60] || (r[60] = n("i", { class: "fa-solid fa-magnifying-glass" }, null, -1)),
              Te(n("input", {
                type: "text",
                placeholder: c.value ? "搜索模型..." : "Search models...",
                "onUpdate:modelValue": r[3] || (r[3] = (l) => B.value = l)
              }, null, 8, Dd), [
                [je, B.value]
              ]),
              B.value ? (f(), v("button", {
                key: 0,
                type: "button",
                class: "ox-vite-vrm-search__clear",
                onClick: r[4] || (r[4] = (l) => B.value = "")
              }, [...r[59] || (r[59] = [
                n("i", { class: "fa-solid fa-xmark" }, null, -1)
              ])])) : q("", !0)
            ]),
            n("div", Id, [
              (f(!0), v(T, null, D(bl.value, (l) => (f(), v("button", {
                key: l.id,
                type: "button",
                class: $(["ox-vite-vrm-row", {
                  "is-active": te.value.selectedModelId === l.id,
                  "is-cloud": l.cloud,
                  "is-downloading": re.value === l.id
                }]),
                disabled: re.value === l.id,
                onClick: (P) => A(l)
              }, [
                n("span", Od, [
                  n("i", {
                    class: $(l.cloud ? "fa-solid fa-cloud-arrow-down" : l.builtin ? "fa-solid fa-vr-cardboard" : "fa-solid fa-cube")
                  }, null, 2)
                ]),
                n("span", $d, [
                  n("span", Fd, o(l.name), 1),
                  n("span", Nd, o(l.cloud ? l.downloaded ? c.value ? "已下载资源" : "Downloaded resource" : c.value ? "云端资源，点击下载" : "Cloud resource, click to download" : l.builtin ? c.value ? "内置模型" : "Built-in" : c.value ? "自定义模型" : "Custom"), 1)
                ]),
                te.value.selectedModelId === l.id ? (f(), v("i", Ld)) : l.cloud ? (f(), v("span", {
                  key: 1,
                  class: $(["ox-vite-vrm-row__download", { "is-ready": l.downloaded }]),
                  onClick: (P) => l.downloaded ? A(l) : E(l, P)
                }, [
                  n("i", {
                    class: $(re.value === l.id ? "fa-solid fa-spinner fa-spin" : l.downloaded ? "fa-solid fa-check" : "fa-solid fa-download")
                  }, null, 2),
                  n("span", null, o(re.value === l.id ? c.value ? "下载中" : "Downloading" : l.downloaded ? c.value ? "使用" : "Use" : c.value ? "下载" : "Download"), 1)
                ], 10, jd)) : q("", !0),
                !l.builtin && (!l.cloud || l.downloaded) ? (f(), v("span", {
                  key: 2,
                  class: "ox-vite-vrm-row__del",
                  title: c.value ? "删除" : "Delete",
                  onClick: (P) => Y(l.id, P)
                }, [...r[61] || (r[61] = [
                  n("i", { class: "fa-regular fa-trash-can" }, null, -1)
                ])], 8, Bd)) : q("", !0)
              ], 10, Vd))), 128)),
              bl.value.length ? q("", !0) : (f(), v("div", Wd, [
                x.value === "custom" && !hs.value.length ? (f(), v("span", Ud, o(c.value ? "尚未上传自定义模型" : "No custom models yet"), 1)) : x.value === "cloud" && !_s.value.length ? (f(), v("span", Kd, o(c.value ? "资源库暂无可下载模型" : "No downloadable models yet"), 1)) : B.value ? (f(), v("span", Hd, o(c.value ? "没有匹配的模型" : "No matching models"), 1)) : (f(), v("span", qd, o(c.value ? "无可用模型" : "No models available"), 1))
              ]))
            ])
          ]),
          n("article", zd, [
            n("div", Yd, [
              n("div", null, [
                n("h2", null, o(c.value ? "动作与窗口" : "Behavior & Window"), 1),
                n("p", null, o(c.value ? "主智能体、表情/动作开关与桌宠默认窗口尺寸。" : "Main agent, expression/motion toggles, and default window size."), 1)
              ])
            ]),
            n("div", Gd, [
              n("label", Qd, [
                n("span", null, o(c.value ? "主智能体" : "Main Agent"), 1),
                n("select", {
                  value: te.value.mainAgent,
                  onChange: Se
                }, [
                  (f(!0), v(T, null, D(te.value.agentOptions || [], (l) => (f(), v("option", {
                    key: l.id,
                    value: l.id
                  }, o(l.name), 9, Jd))), 128))
                ], 40, Xd)
              ]),
              n("label", Zd, [
                n("span", null, o(c.value ? "启用表情" : "Enable expressions"), 1),
                n("span", ep, [
                  n("input", {
                    type: "checkbox",
                    checked: te.value.enabledExpressions,
                    onChange: Q
                  }, null, 40, tp),
                  n("span", null, o(te.value.enabledExpressions ? c.value ? "已开启" : "On" : c.value ? "已关闭" : "Off"), 1)
                ])
              ]),
              n("label", np, [
                n("span", null, o(c.value ? "启用动作" : "Enable motions"), 1),
                n("span", sp, [
                  n("input", {
                    type: "checkbox",
                    checked: te.value.enabledMotions,
                    onChange: le
                  }, null, 40, lp),
                  n("span", null, o(te.value.enabledMotions ? c.value ? "已开启" : "On" : c.value ? "已关闭" : "Off"), 1)
                ])
              ]),
              n("label", op, [
                n("span", null, o(c.value ? "窗口宽度 (px)" : "Width (px)"), 1),
                n("input", {
                  type: "number",
                  min: "300",
                  max: "3840",
                  step: "10",
                  value: te.value.windowWidth,
                  onChange: pe
                }, null, 40, ip)
              ]),
              n("label", ap, [
                n("span", null, o(c.value ? "窗口高度 (px)" : "Height (px)"), 1),
                n("input", {
                  type: "number",
                  min: "300",
                  max: "3840",
                  step: "10",
                  value: te.value.windowHeight,
                  onChange: ve
                }, null, 40, rp)
              ])
            ])
          ]),
          n("article", cp, [
            n("div", up, [
              n("div", null, [
                n("h2", null, o(c.value ? "VRMA 动作" : "VRMA Motions"), 1),
                n("p", null, o(c.value ? "在内置 / 自定义两组动作里勾选启用项，会同步进桌宠运行环境。" : "Tick motions from built-in or custom groups; the desktop pet picks them up."), 1)
              ]),
              n("button", {
                type: "button",
                class: "ox-vite-ops-secondary-btn",
                onClick: Ze
              }, [
                r[62] || (r[62] = n("i", { class: "fa-solid fa-plus" }, null, -1)),
                n("span", null, o(c.value ? "上传动作" : "Upload"), 1)
              ])
            ]),
            n("div", dp, [
              n("button", {
                type: "button",
                class: $(["ox-vite-vrm-tab", { "is-active": he.value === "builtin" }]),
                onClick: r[5] || (r[5] = (l) => he.value = "builtin")
              }, [
                r[63] || (r[63] = n("i", { class: "fa-solid fa-star" }, null, -1)),
                n("span", null, o(c.value ? "内置动作" : "Built-in"), 1),
                n("span", pp, o(xl.value.length), 1)
              ], 2),
              n("button", {
                type: "button",
                class: $(["ox-vite-vrm-tab", { "is-active": he.value === "custom" }]),
                onClick: r[6] || (r[6] = (l) => he.value = "custom")
              }, [
                r[64] || (r[64] = n("i", { class: "fa-solid fa-user" }, null, -1)),
                n("span", null, o(c.value ? "自定义" : "Custom"), 1),
                n("span", fp, o(ys.value.length), 1)
              ], 2)
            ]),
            n("div", vp, [
              r[66] || (r[66] = n("i", { class: "fa-solid fa-magnifying-glass" }, null, -1)),
              Te(n("input", {
                type: "text",
                placeholder: c.value ? "搜索动作..." : "Search motions...",
                "onUpdate:modelValue": r[7] || (r[7] = (l) => ce.value = l)
              }, null, 8, gp), [
                [je, ce.value]
              ]),
              ce.value ? (f(), v("button", {
                key: 0,
                type: "button",
                class: "ox-vite-vrm-search__clear",
                onClick: r[8] || (r[8] = (l) => ce.value = "")
              }, [...r[65] || (r[65] = [
                n("i", { class: "fa-solid fa-xmark" }, null, -1)
              ])])) : q("", !0)
            ]),
            n("div", mp, [
              (f(!0), v(T, null, D(Sl.value, (l) => (f(), v("button", {
                key: l.id,
                type: "button",
                class: $(["ox-vite-vrm-row", { "is-active": l.selected }]),
                onClick: (P) => j(l.id)
              }, [
                n("span", hp, [
                  n("i", {
                    class: $(l.selected ? "fa-solid fa-circle-check" : "fa-regular fa-circle")
                  }, null, 2)
                ]),
                n("span", yp, [
                  n("span", bp, o(l.name), 1),
                  n("span", xp, o(l.builtin ? c.value ? "内置动作" : "Built-in" : c.value ? "自定义动作" : "Custom"), 1)
                ]),
                l.builtin ? q("", !0) : (f(), v("span", {
                  key: 0,
                  class: "ox-vite-vrm-row__del",
                  title: c.value ? "删除" : "Delete",
                  onClick: (P) => H(l.id, P)
                }, [...r[67] || (r[67] = [
                  n("i", { class: "fa-regular fa-trash-can" }, null, -1)
                ])], 8, Sp))
              ], 10, _p))), 128)),
              Sl.value.length ? q("", !0) : (f(), v("div", kp, [
                he.value === "custom" && !ys.value.length ? (f(), v("span", wp, o(c.value ? "尚未上传自定义动作" : "No custom motions yet"), 1)) : ce.value ? (f(), v("span", Cp, o(c.value ? "没有匹配的动作" : "No matching motions"), 1)) : (f(), v("span", Mp, o(c.value ? "无可用动作" : "No motions available"), 1))
              ]))
            ])
          ])
        ]),
        n("aside", Rp, [
          n("div", Tp, [
            n("div", null, [
              n("h2", null, o(c.value ? "实时预览" : "Live Preview"), 1),
              n("p", null, [
                n("span", null, o(te.value.selectedModel?.name || (c.value ? "未选择模型" : "No model")), 1),
                Wn.value.length ? (f(), v("span", Ep, " · " + o(Wn.value.length) + " " + o(c.value ? "个动作" : "motions"), 1)) : q("", !0)
              ])
            ]),
            n("label", Pp, [
              Te(n("input", {
                type: "checkbox",
                "onUpdate:modelValue": r[9] || (r[9] = (l) => He.value = l)
              }, null, 512), [
                [no, He.value]
              ]),
              n("span", null, o(He.value ? c.value ? "关闭预览" : "Hide" : c.value ? "开启预览" : "Show"), 1)
            ])
          ]),
          n("div", Ap, [
            He.value && te.value.previewUrl && te.value.isElectron ? (f(), v("div", Dp, [
              (f(), v("webview", {
                key: te.value.previewKey || te.value.previewUrl,
                src: te.value.previewUrl,
                partition: "persist:openxnet-vrm-preview",
                class: "ox-vite-vrm-preview__webview",
                allowpopups: "",
                webpreferences: "transparent=true"
              }, null, 8, Ip))
            ])) : He.value && te.value.previewUrl ? (f(), v("div", Vp, [
              (f(), v("iframe", {
                key: te.value.previewKey || te.value.previewUrl,
                src: te.value.previewUrl,
                class: "ox-vite-vrm-preview__iframe",
                referrerpolicy: "no-referrer",
                allowtransparency: "true"
              }, null, 8, Op))
            ])) : (f(), v("div", $p, [
              r[68] || (r[68] = n("div", { class: "ox-vite-vrm-preview__hero" }, [
                n("i", { class: "fa-solid fa-vr-cardboard" })
              ], -1)),
              n("h3", null, o(te.value.selectedModel?.name || (c.value ? "未选择模型" : "No model selected")), 1),
              n("p", null, o(c.value ? '点击"开启预览"加载 VRM 模型，桌宠未运行时也能看到当前选择的模型与动作。' : "Toggle preview to load the VRM. Visible even when the desktop pet is stopped."), 1)
            ]))
          ]),
          n("div", Fp, [
            n("button", {
              type: "button",
              class: "ox-vite-ops-secondary-btn",
              onClick: O
            }, [
              r[69] || (r[69] = n("i", { class: "fa-solid fa-window-maximize" }, null, -1)),
              n("span", null, o(c.value ? "浏览器预览" : "Browser preview"), 1)
            ]),
            te.value.isElectron ? (f(), v("button", {
              key: 0,
              type: "button",
              class: "ox-vite-ops-primary-btn",
              disabled: te.value.starting,
              onClick: N
            }, [
              n("i", {
                class: $(te.value.starting ? "fa-solid fa-spinner fa-spin" : te.value.running ? "fa-solid fa-rotate" : "fa-solid fa-play")
              }, null, 2),
              n("span", null, o(te.value.starting ? c.value ? "启动中..." : "Starting..." : te.value.running ? c.value ? "重启桌宠" : "Restart pet" : c.value ? "启动桌宠" : "Start pet"), 1)
            ], 8, Np)) : q("", !0)
          ]),
          Wn.value.length ? (f(), v("div", Lp, [
            n("div", jp, o(c.value ? "已启用动作" : "Enabled motions"), 1),
            n("div", Bp, [
              (f(!0), v(T, null, D(Wn.value, (l) => (f(), v("span", {
                key: l.id,
                class: "ox-vite-detail-chip"
              }, [
                r[70] || (r[70] = n("i", { class: "fa-solid fa-person-running" }, null, -1)),
                n("span", null, o(l.name), 1)
              ]))), 128))
            ])
          ])) : q("", !0),
          n("div", Wp, [
            n("button", {
              type: "button",
              class: "ox-vite-ops-secondary-btn",
              onClick: O
            }, [
              r[71] || (r[71] = n("i", { class: "fa-solid fa-window-maximize" }, null, -1)),
              n("span", null, o(c.value ? "浏览器" : "Browser"), 1)
            ]),
            te.value.isElectron ? (f(), v("button", {
              key: 0,
              type: "button",
              class: "ox-vite-ops-primary-btn",
              disabled: te.value.starting,
              onClick: N
            }, [
              n("i", {
                class: $(te.value.starting ? "fa-solid fa-spinner fa-spin" : "fa-solid fa-play")
              }, null, 2),
              n("span", null, o(te.value.running ? c.value ? "重启" : "Restart" : c.value ? "启动" : "Start"), 1)
            ], 8, Up)) : q("", !0)
          ])
        ])
      ])) : (f(), v(T, { key: 3 }, [
        n("div", Kp, [
          n("div", null, [
            n("div", Hp, o(h.value.meta?.title || h.value.title), 1),
            n("h1", null, o(h.value.title), 1),
            n("p", null, o(h.value.subtitle), 1)
          ]),
          n("div", qp, [
            n("button", {
              type: "button",
              class: "ox-vite-ops-secondary-btn",
              onClick: g
            }, [
              r[72] || (r[72] = n("i", { class: "fa-solid fa-rotate-right" }, null, -1)),
              n("span", null, o(c.value ? "同步状态" : "Sync Status"), 1)
            ]),
            ["deploy", "workbench", "storage", "kernel", "system"].includes(t.surface) ? (f(), v("button", {
              key: 0,
              type: "button",
              class: "ox-vite-ops-primary-btn",
              onClick: K
            }, [
              n("i", {
                class: $(t.surface === "storage" && h.value.activeTab === "memory-v3" ? "fa-solid fa-plus" : "fa-solid fa-arrow-right")
              }, null, 2),
              n("span", null, o(t.surface === "deploy" ? c.value ? "启动主机器人" : "Start primary bot" : t.surface === "workbench" ? c.value ? "打开任务中心" : "Open task center" : t.surface === "storage" ? h.value.activeTab === "memory-v3" ? c.value ? "新建记忆" : "New memory" : c.value ? "进入文件库" : "Open file vault" : t.surface === "kernel" ? c.value ? "查看行动队列" : "Open action queue" : h.value.activeTab === "about" ? c.value ? "检查更新" : "Check Updates" : c.value ? "查看更新内容" : "Open update content"), 1)
            ])) : q("", !0)
          ])
        ]),
        t.surface === "system" ? (f(), v("div", zp, [
          n("aside", Yp, [
            (f(!0), v(T, null, D(h.value.tabs || [], (l) => (f(), v("button", {
              key: l.id,
              type: "button",
              class: $(["ox-vite-side-tab", { active: h.value.activeTab === l.id }]),
              onClick: (P) => p(l.id)
            }, [
              n("i", {
                class: $(l.icon)
              }, null, 2),
              n("span", null, o(l.label), 1)
            ], 10, Gp))), 128))
          ]),
          n("main", Qp, [
            n("section", Xp, [
              (f(!0), v(T, null, D(h.value.stats || [], (l) => (f(), v("article", {
                key: l.label,
                class: $(["ox-vite-stat-card", { emphasis: l.emphasis }])
              }, [
                n("span", null, o(l.label), 1),
                n("strong", null, o(l.value), 1),
                n("small", null, o(l.meta), 1)
              ], 2))), 128))
            ]),
            n("section", Jp, [
              n("div", Zp, [
                n("h2", null, o(h.value.currentMeta?.heading), 1),
                n("p", null, o(h.value.currentMeta?.summary), 1)
              ]),
              h.value.activeTab === "general" ? (f(), v("div", ef, [
                n("section", tf, [
                  n("div", nf, o(c.value ? "语言与区域" : "Language & Region"), 1),
                  n("article", sf, [
                    n("div", null, [
                      n("strong", null, o(c.value ? "界面语言" : "Interface Language"), 1),
                      n("p", null, o(c.value ? "选择 OpenXnet 界面显示语言。" : "Choose the language used by the OpenXnet interface."), 1)
                    ]),
                    n("select", {
                      class: "ox-vite-select",
                      value: h.value.settings?.language,
                      onChange: r[10] || (r[10] = (l) => V("language", l))
                    }, [
                      (f(!0), v(T, null, D(h.value.languageOptions || [], (l) => (f(), v("option", {
                        key: l.value,
                        value: l.value
                      }, o(l.label), 9, of))), 128))
                    ], 40, lf)
                  ]),
                  n("article", af, [
                    n("div", null, [
                      n("strong", null, o(c.value ? "目标输出语言" : "Target Output Language"), 1),
                      n("p", null, o(c.value ? "控制模型回答时优先使用的语言。" : "Controls the preferred language for model replies."), 1)
                    ]),
                    n("select", {
                      class: "ox-vite-select",
                      value: h.value.targetLanguage,
                      onChange: Z
                    }, [
                      (f(!0), v(T, null, D(h.value.targetLanguageOptions || [], (l) => (f(), v("option", {
                        key: l.value,
                        value: l.value
                      }, o(l.label), 9, cf))), 128))
                    ], 40, rf)
                  ]),
                  n("article", uf, [
                    n("div", null, [
                      n("strong", null, o(c.value ? "时区" : "Timezone"), 1),
                      n("p", null, o(c.value ? "用于时间显示、任务计划和更新记录。" : "Used by timestamps, scheduled tasks, and release records."), 1)
                    ]),
                    n("div", df, [
                      (f(!0), v(T, null, D(h.value.timezoneOptions || [], (l) => (f(), v("button", {
                        key: l.value,
                        type: "button",
                        class: $({ active: h.value.settings?.timezone === l.value }),
                        onClick: (P) => w("timezone", l.value)
                      }, o(l.label), 11, pf))), 128))
                    ])
                  ]),
                  n("article", ff, [
                    n("div", null, [
                      n("strong", null, o(c.value ? "日期格式" : "Date Format"), 1),
                      n("p", null, o(c.value ? "选择日期在系统页面中的显示方式。" : "Choose how dates are displayed across system pages."), 1)
                    ]),
                    n("div", vf, [
                      (f(!0), v(T, null, D(h.value.dateFormatOptions || [], (l) => (f(), v("button", {
                        key: l.value,
                        type: "button",
                        class: $({ active: h.value.settings?.dateFormat === l.value }),
                        onClick: (P) => w("dateFormat", l.value)
                      }, o(l.label), 11, gf))), 128))
                    ])
                  ])
                ]),
                n("section", mf, [
                  n("div", _f, o(c.value ? "启动行为" : "Startup"), 1),
                  n("article", hf, [
                    n("div", null, [
                      n("strong", null, o(c.value ? "开机自启" : "Launch at Startup"), 1),
                      n("p", null, o(c.value ? "系统启动后自动运行 OpenXnet。" : "Run OpenXnet automatically after system startup."), 1)
                    ]),
                    n("label", yf, [
                      n("input", {
                        type: "checkbox",
                        checked: h.value.settings?.launchAtStartup,
                        onChange: r[11] || (r[11] = (l) => L("launchAtStartup", l))
                      }, null, 40, bf),
                      r[73] || (r[73] = n("span", null, null, -1))
                    ])
                  ]),
                  n("article", xf, [
                    n("div", null, [
                      n("strong", null, o(c.value ? "启动时最小化" : "Start Minimized"), 1),
                      n("p", null, o(c.value ? "启动后进入托盘，不打断当前桌面。" : "Start into the tray without interrupting the desktop."), 1)
                    ]),
                    n("label", Sf, [
                      n("input", {
                        type: "checkbox",
                        checked: h.value.settings?.startMinimized,
                        onChange: r[12] || (r[12] = (l) => L("startMinimized", l))
                      }, null, 40, kf),
                      r[74] || (r[74] = n("span", null, null, -1))
                    ])
                  ])
                ]),
                n("section", wf, [
                  n("div", Cf, o(c.value ? "数据与隐私" : "Data & Privacy"), 1),
                  n("article", Mf, [
                    n("div", null, [
                      n("strong", null, o(c.value ? "清理运行缓存" : "Clear Runtime Cache"), 1),
                      n("p", null, o(c.value ? "清理 Service Worker 与 Cache Storage，重新加载后获取最新 UI。" : "Clear Service Worker and Cache Storage so the latest UI loads after refresh."), 1)
                    ]),
                    n("button", {
                      type: "button",
                      class: "ox-vite-ops-secondary-btn",
                      onClick: W
                    }, [
                      r[75] || (r[75] = n("i", { class: "fa-solid fa-broom" }, null, -1)),
                      n("span", null, o(c.value ? "清除缓存" : "Clear"), 1)
                    ])
                  ])
                ])
              ])) : h.value.activeTab === "appearance" ? (f(), v("div", Rf, [
                n("section", Tf, [
                  n("div", Ef, o(c.value ? "主题模式" : "Theme Mode"), 1),
                  n("div", Pf, [
                    (f(!0), v(T, null, D(h.value.themeOptions || [], (l) => (f(), v("button", {
                      key: l.value,
                      type: "button",
                      class: $(["ox-vite-theme-card", { active: h.value.settings?.theme === l.value }]),
                      onClick: (P) => w("theme", l.value)
                    }, [
                      n("span", {
                        class: $(["ox-vite-theme-card__preview", `theme-${l.value}`])
                      }, [...r[76] || (r[76] = [
                        n("i", null, null, -1),
                        n("i", null, null, -1),
                        n("i", null, null, -1)
                      ])], 2),
                      n("strong", null, o(l.label), 1),
                      n("small", null, o(h.value.settings?.theme === l.value ? c.value ? "当前使用" : "Current" : c.value ? "点击切换" : "Switch"), 1)
                    ], 10, Af))), 128))
                  ])
                ])
              ])) : h.value.activeTab === "shortcuts" ? (f(), v("div", Df, [
                n("section", If, [
                  n("div", Vf, o(c.value ? "已注册快捷键" : "Registered Shortcuts"), 1),
                  (f(!0), v(T, null, D(h.value.shortcutRows || [], (l) => (f(), v("article", {
                    key: l.key || l.label,
                    class: "ox-vite-settings-row"
                  }, [
                    n("div", null, [
                      n("strong", null, o(l.label), 1),
                      n("p", null, o(l.description), 1)
                    ]),
                    n("div", Of, [
                      n("kbd", null, o(l.shortcut), 1),
                      n("span", {
                        class: $(["ox-vite-status-pill", { active: l.registered }])
                      }, o(l.registered ? c.value ? "已注册" : "Ready" : c.value ? "未注册" : "Unavailable"), 3)
                    ])
                  ]))), 128))
                ]),
                n("section", $f, [
                  n("div", Ff, o(c.value ? "快速操作" : "Quick Actions"), 1),
                  (f(!0), v(T, null, D(h.value.quickActions || [], (l) => (f(), v("article", {
                    key: l.id,
                    class: "ox-vite-settings-row"
                  }, [
                    n("div", null, [
                      n("strong", null, [
                        n("i", {
                          class: $(l.icon)
                        }, null, 2),
                        et(o(l.label), 1)
                      ]),
                      n("p", null, o(l.description), 1)
                    ]),
                    n("button", {
                      type: "button",
                      class: "ox-vite-ops-secondary-btn",
                      onClick: (P) => ae(l.id)
                    }, [
                      r[77] || (r[77] = n("i", { class: "fa-solid fa-arrow-up-right-from-square" }, null, -1)),
                      n("span", null, o(c.value ? "打开" : "Open"), 1)
                    ], 8, Nf)
                  ]))), 128))
                ])
              ])) : h.value.activeTab === "network" ? (f(), v("div", Lf, [
                n("section", jf, [
                  n("div", Bf, o(c.value ? "网络与代理" : "Network & Proxy"), 1),
                  n("article", Wf, [
                    n("div", null, [
                      n("strong", null, o(c.value ? "网络模式" : "Network Mode"), 1),
                      n("p", null, o(c.value ? "决定桌面服务在本机或局域网中的可见范围。" : "Controls whether the desktop service is local-only or visible on the LAN."), 1)
                    ]),
                    n("select", {
                      class: "ox-vite-select",
                      value: h.value.settings?.network,
                      onChange: r[13] || (r[13] = (l) => V("network", l))
                    }, [
                      (f(!0), v(T, null, D(h.value.networkOptions || [], (l) => (f(), v("option", {
                        key: l.value,
                        value: l.value
                      }, o(l.label), 9, Kf))), 128))
                    ], 40, Uf)
                  ]),
                  n("article", Hf, [
                    n("div", null, [
                      n("strong", null, o(c.value ? "代理模式" : "Proxy Mode"), 1),
                      n("p", null, o(c.value ? "用于模型、插件、资源下载和外部服务访问。" : "Used for models, plugins, resource downloads, and external services."), 1)
                    ]),
                    n("select", {
                      class: "ox-vite-select",
                      value: h.value.settings?.proxyMode,
                      onChange: r[14] || (r[14] = (l) => V("proxyMode", l))
                    }, [
                      (f(!0), v(T, null, D(h.value.proxyOptions || [], (l) => (f(), v("option", {
                        key: l.value,
                        value: l.value
                      }, o(l.label), 9, zf))), 128))
                    ], 40, qf)
                  ]),
                  h.value.settings?.proxyMode === "manual" ? (f(), v("article", Yf, [
                    n("div", null, [
                      n("strong", null, o(c.value ? "代理地址" : "Proxy Address"), 1),
                      n("p", null, o(c.value ? "示例：http://127.0.0.1:7890。SOCKS 代理会被后端保护性拦截。" : "Example: http://127.0.0.1:7890. SOCKS proxies are blocked by the backend guard."), 1)
                    ]),
                    n("input", {
                      class: "ox-vite-text-input",
                      value: h.value.settings?.proxy,
                      type: "text",
                      placeholder: "http://127.0.0.1:7890",
                      onChange: r[15] || (r[15] = (l) => V("proxy", l))
                    }, null, 40, Gf)
                  ])) : q("", !0)
                ])
              ])) : h.value.activeTab === "feature-packs" ? (f(), v("div", Qf, [
                n("div", Xf, [
                  n("div", Jf, [
                    n("span", {
                      class: $(["ox-vite-feature-pack-feed-state", `is-${$e.value.feedStatus || "unavailable"}`])
                    }, [
                      n("i", {
                        class: $($e.value.feedStatus === "ready" ? "fa-solid fa-shield-halved" : "fa-solid fa-circle-exclamation")
                      }, null, 2),
                      n("span", null, o($e.value.feedStatus === "ready" ? c.value ? "可信分发已连接" : "Trusted feed connected" : $e.value.feedStatus === "not-configured" ? c.value ? "分发未配置" : "Distribution not configured" : $e.value.feedStatus === "loading" ? c.value ? "正在同步" : "Syncing" : c.value ? "分发不可用" : "Distribution unavailable"), 1)
                    ], 2),
                    $e.value.catalogGeneratedAt ? (f(), v("small", Zf, o(c.value ? "目录时间" : "Catalog") + ": " + o($e.value.catalogGeneratedAt), 1)) : q("", !0)
                  ]),
                  n("button", {
                    type: "button",
                    class: "ox-vite-icon-btn",
                    disabled: $e.value.loading,
                    title: c.value ? "刷新功能包目录" : "Refresh Feature Pack catalog",
                    onClick: ne
                  }, [
                    n("i", {
                      class: $($e.value.loading ? "fa-solid fa-spinner fa-spin" : "fa-solid fa-rotate-right")
                    }, null, 2)
                  ], 8, ev)
                ]),
                $e.value.error ? (f(), v("div", tv, [
                  r[78] || (r[78] = n("i", { class: "fa-solid fa-triangle-exclamation" }, null, -1)),
                  n("span", null, o($e.value.error.message), 1)
                ])) : $e.value.feedStatus === "not-configured" ? (f(), v("div", nv, [
                  r[79] || (r[79] = n("i", { class: "fa-solid fa-lock" }, null, -1)),
                  n("span", null, o(c.value ? "远程安装已停用；应用信任存储和分发地址尚未配置。" : "Remote installation is disabled because the application trust store and feed are not configured."), 1)
                ])) : $e.value.available ? q("", !0) : (f(), v("div", sv, [
                  r[80] || (r[80] = n("i", { class: "fa-solid fa-desktop" }, null, -1)),
                  n("span", null, o(c.value ? "功能包管理仅在桌面应用中可用。" : "Feature Pack management is available in the desktop application."), 1)
                ])),
                n("div", lv, [
                  (f(!0), v(T, null, D($e.value.items || [], (l) => (f(), v("article", {
                    key: l.capabilityId,
                    class: $(["ox-vite-feature-pack-row", [`is-${l.status}`, { "is-busy": se(l) }]])
                  }, [
                    n("div", ov, [
                      n("span", iv, [
                        n("i", {
                          class: $(l.icon)
                        }, null, 2)
                      ]),
                      n("div", null, [
                        n("strong", null, o(l.displayName), 1),
                        n("p", null, o(l.description), 1)
                      ])
                    ]),
                    n("div", av, [
                      n("span", null, [
                        n("small", null, o(c.value ? "已安装" : "Installed"), 1),
                        n("strong", null, o(l.installedVersion || "—"), 1)
                      ]),
                      n("span", null, [
                        n("small", null, o(c.value ? "可用版本" : "Available"), 1),
                        n("strong", null, o(l.availableVersion || "—"), 1)
                      ])
                    ]),
                    n("div", rv, [
                      n("span", {
                        class: $(["ox-vite-feature-pack-status", `is-${l.status}`])
                      }, [
                        n("i", {
                          class: $(Pe(l.status))
                        }, null, 2),
                        n("span", null, o(Ee(l.status)), 1)
                      ], 2),
                      l.restartRequired ? (f(), v("span", cv, [
                        r[81] || (r[81] = n("i", { class: "fa-solid fa-power-off" }, null, -1)),
                        n("span", null, o(c.value ? "重启后生效" : "Restart required"), 1)
                      ])) : q("", !0)
                    ]),
                    n("div", uv, [
                      l.status === "not-installed" || l.status === "update-available" ? (f(), v("button", {
                        key: 0,
                        type: "button",
                        class: "ox-vite-ops-primary-btn",
                        disabled: se(l) || $e.value.feedStatus !== "ready",
                        onClick: (P) => U("install", l)
                      }, [
                        n("i", {
                          class: $(se(l) ? "fa-solid fa-spinner fa-spin" : l.status === "update-available" ? "fa-solid fa-arrow-up" : "fa-solid fa-download")
                        }, null, 2),
                        n("span", null, o(l.status === "update-available" ? c.value ? "更新" : "Update" : c.value ? "安装" : "Install"), 1)
                      ], 8, dv)) : (f(), v("button", {
                        key: 1,
                        type: "button",
                        class: "ox-vite-ops-secondary-btn",
                        disabled: se(l) || $e.value.feedStatus !== "ready",
                        onClick: (P) => U("repair", l)
                      }, [
                        n("i", {
                          class: $(se(l) ? "fa-solid fa-spinner fa-spin" : "fa-solid fa-screwdriver-wrench")
                        }, null, 2),
                        n("span", null, o(c.value ? "修复" : "Repair"), 1)
                      ], 8, pv)),
                      l.installedVersion || l.status === "damaged" ? (f(), v("button", {
                        key: 2,
                        type: "button",
                        class: "ox-vite-icon-btn is-danger",
                        disabled: se(l),
                        title: c.value ? "卸载功能包" : "Uninstall Feature Pack",
                        onClick: (P) => U("uninstall", l)
                      }, [...r[82] || (r[82] = [
                        n("i", { class: "fa-regular fa-trash-can" }, null, -1)
                      ])], 8, fv)) : q("", !0)
                    ]),
                    l.progress ? (f(), v("div", {
                      key: 0,
                      class: $(["ox-vite-feature-pack-progress", { "is-failed": l.progress.phase === "failed" }])
                    }, [
                      n("div", vv, [
                        n("span", null, o(Ke(l.progress.phase)), 1),
                        l.progress.transferredBytes !== null && l.progress.totalBytes !== null ? (f(), v("span", gv, o(pt(l.progress.transferredBytes)) + " / " + o(pt(l.progress.totalBytes)), 1)) : l.progress.percent !== null ? (f(), v("span", mv, o(l.progress.percent) + "%", 1)) : q("", !0)
                      ]),
                      n("div", _v, [
                        n("span", {
                          class: $({ "is-indeterminate": l.progress.percent === null && !["completed", "failed"].includes(l.progress.phase) }),
                          style: rt({ width: l.progress.percent === null ? l.progress.phase === "completed" ? "100%" : "28%" : `${l.progress.percent}%` })
                        }, null, 6)
                      ]),
                      l.progress.error ? (f(), v("p", hv, o(l.progress.error.message), 1)) : q("", !0)
                    ], 2)) : q("", !0)
                  ], 2))), 128))
                ])
              ])) : h.value.activeTab === "advanced" ? (f(), v("div", yv, [
                n("section", bv, [
                  n("div", xv, o(c.value ? "文件与目录" : "Files & Directories"), 1),
                  n("article", Sv, [
                    n("div", null, [
                      n("strong", null, o(c.value ? "用户数据目录" : "User Data Folder"), 1),
                      n("p", null, o(c.value ? "配置、会话、本地资产和数据库所在目录。" : "Folder for settings, conversations, local assets, and databases."), 1)
                    ]),
                    n("button", {
                      type: "button",
                      class: "ox-vite-ops-secondary-btn",
                      onClick: r[16] || (r[16] = (l) => F("user"))
                    }, [
                      r[83] || (r[83] = n("i", { class: "fa-solid fa-folder-open" }, null, -1)),
                      n("span", null, o(c.value ? "打开" : "Open"), 1)
                    ])
                  ]),
                  n("article", kv, [
                    n("div", null, [
                      n("strong", null, o(c.value ? "日志目录" : "Log Folder"), 1),
                      n("p", null, o(c.value ? "桌面端与后端运行日志，用于排查启动、更新和接口问题。" : "Desktop and backend logs for startup, update, and API diagnostics."), 1)
                    ]),
                    n("button", {
                      type: "button",
                      class: "ox-vite-ops-secondary-btn",
                      onClick: r[17] || (r[17] = (l) => F("logs"))
                    }, [
                      r[84] || (r[84] = n("i", { class: "fa-solid fa-file-lines" }, null, -1)),
                      n("span", null, o(c.value ? "打开" : "Open"), 1)
                    ])
                  ]),
                  n("article", wv, [
                    n("div", null, [
                      n("strong", null, o(c.value ? "扩展目录" : "Extension Folder"), 1),
                      n("p", null, o(c.value ? "插件、扩展与外部能力文件目录。" : "Folder for plugins, extensions, and external capability files."), 1)
                    ]),
                    n("button", {
                      type: "button",
                      class: "ox-vite-ops-secondary-btn",
                      onClick: r[18] || (r[18] = (l) => F("extensions"))
                    }, [
                      r[85] || (r[85] = n("i", { class: "fa-solid fa-puzzle-piece" }, null, -1)),
                      n("span", null, o(c.value ? "打开" : "Open"), 1)
                    ])
                  ])
                ]),
                n("section", Cv, [
                  n("div", Mv, o(c.value ? "维护操作" : "Maintenance"), 1),
                  n("article", Rv, [
                    n("div", null, [
                      n("strong", null, o(c.value ? "清理运行缓存" : "Clear Runtime Cache"), 1),
                      n("p", null, o(c.value ? "清理前端缓存，不会删除用户会话和配置。" : "Clear frontend runtime cache without deleting conversations or settings."), 1)
                    ]),
                    n("button", {
                      type: "button",
                      class: "ox-vite-ops-secondary-btn",
                      onClick: W
                    }, [
                      r[86] || (r[86] = n("i", { class: "fa-solid fa-broom" }, null, -1)),
                      n("span", null, o(c.value ? "清除" : "Clear"), 1)
                    ])
                  ]),
                  n("article", Tv, [
                    n("div", null, [
                      n("strong", null, o(c.value ? "恢复默认系统设置" : "Reset System Settings"), 1),
                      n("p", null, o(c.value ? "仅恢复系统设置页中的语言、主题、启动、网络和代理选项。" : "Only resets language, theme, startup, network, and proxy options in this page."), 1)
                    ]),
                    n("button", {
                      type: "button",
                      class: "ox-vite-danger-btn",
                      onClick: G
                    }, [
                      r[87] || (r[87] = n("i", { class: "fa-solid fa-rotate-left" }, null, -1)),
                      n("span", null, o(c.value ? "恢复默认" : "Reset"), 1)
                    ])
                  ])
                ])
              ])) : (f(), v("div", Ev, [
                n("article", Pv, [
                  n("div", Av, [
                    n("h2", null, o(c.value ? "当前发布状态" : "Current Release Status"), 1),
                    n("p", null, o(c.value ? "版本更新、更新检测与优化说明都会统一汇总在这里。" : "Release updates, update checks, and optimization notes are collected here."), 1)
                  ]),
                  n("div", Dv, [
                    n("span", Iv, "v" + o(h.value.version), 1),
                    n("span", Vv, o(h.value.updateStatus || "idle"), 1),
                    n("span", Ov, o(h.value.updateAvailable ? c.value ? "发现新版本" : "Update Available" : c.value ? "当前已同步" : "Up to Date"), 1)
                  ]),
                  n("div", $v, [
                    n("article", Fv, [
                      n("strong", null, o(c.value ? "更新状态" : "Update Status"), 1),
                      n("p", null, o(h.value.updateStatusTitle || (c.value ? "等待下一次更新检查。" : "Waiting for the next update check.")), 1)
                    ]),
                    n("article", Nv, [
                      n("strong", null, o(c.value ? "状态说明" : "Status Detail"), 1),
                      n("p", null, o(h.value.updateStatusDescription || h.value.updateMessage || (c.value ? "等待下一次更新检查。" : "Waiting for the next update check.")), 1)
                    ]),
                    n("article", Lv, [
                      n("strong", null, o(c.value ? "更新节奏" : "Check Cadence"), 1),
                      n("p", null, o(c.value ? "启动后首次静默检查，之后每 1 小时自动检测一次。" : "A silent check runs shortly after launch, then once every hour."), 1)
                    ])
                  ]),
                  n("div", jv, [
                    n("button", {
                      type: "button",
                      class: "ox-vite-ops-primary-btn",
                      onClick: S
                    }, [
                      r[88] || (r[88] = n("i", { class: "fa-solid fa-rotate-right" }, null, -1)),
                      n("span", null, o(c.value ? "检查更新" : "Check for Updates"), 1)
                    ]),
                    n("button", {
                      type: "button",
                      class: "ox-vite-ops-secondary-btn",
                      onClick: b
                    }, [
                      r[89] || (r[89] = n("i", { class: "fa-solid fa-circle-info" }, null, -1)),
                      n("span", null, o(c.value ? "查看关于页" : "Open About Page"), 1)
                    ])
                  ])
                ]),
                (f(!0), v(T, null, D(h.value.updateEntries || [], (l) => (f(), v("article", {
                  key: `${l.version}-${l.date}-${l.title}`,
                  class: "ox-vite-panel-card"
                }, [
                  n("div", Bv, [
                    n("h2", null, o(l.title), 1),
                    n("p", null, o(l.date), 1)
                  ]),
                  n("div", Wv, [
                    n("span", Uv, o(l.version), 1),
                    (f(!0), v(T, null, D(l.modules || [], (P) => (f(), v("span", {
                      key: l.version + P,
                      class: "ox-vite-detail-chip"
                    }, o(P), 1))), 128))
                  ]),
                  n("ul", Kv, [
                    (f(!0), v(T, null, D(l.highlights || [], (P) => (f(), v("li", { key: P }, o(P), 1))), 128))
                  ])
                ]))), 128))
              ]))
            ])
          ])
        ])) : (f(), v("div", Hv, [
          n("div", {
            class: $(t.surface === "enterprise" ? "ox-vite-system-layout" : "ox-vite-ops-main")
          }, [
            t.surface === "enterprise" ? (f(), v("aside", qv, [
              (f(!0), v(T, null, D(h.value.tabs || [], (l) => (f(), v("button", {
                key: l.id,
                type: "button",
                class: $(["ox-vite-side-tab", { active: h.value.activeTab === l.id }]),
                onClick: (P) => p(l.id)
              }, [
                n("i", {
                  class: $(l.icon)
                }, null, 2),
                n("span", null, o(l.label), 1)
              ], 10, zv))), 128))
            ])) : q("", !0),
            n("main", Yv, [
              t.surface !== "kernel" ? (f(), v("div", Gv, [
                (f(!0), v(T, null, D(t.surface === "enterprise" ? [] : h.value.tabs || [], (l) => (f(), v("button", {
                  key: l.id,
                  type: "button",
                  class: $(["ox-vite-strip-tab", { active: h.value.activeTab === l.id }]),
                  onClick: (P) => p(l.id)
                }, [
                  n("i", {
                    class: $(l.icon)
                  }, null, 2),
                  n("span", null, o(l.label), 1)
                ], 10, Qv))), 128))
              ])) : q("", !0),
              h.value.meta?.summary && !(t.surface === "enterprise" || t.surface === "workbench" && h.value.activeTab === "develop") ? (f(), v("section", Xv, [
                n("p", null, o(h.value.meta.summary), 1),
                n("div", Jv, [
                  (f(!0), v(T, null, D(h.value.meta.chips || [], (l) => (f(), v("span", {
                    key: l.icon + l.text,
                    class: "ox-vite-detail-chip"
                  }, [
                    n("i", {
                      class: $(l.icon)
                    }, null, 2),
                    n("span", null, o(l.text), 1)
                  ]))), 128))
                ])
              ])) : q("", !0),
              h.value.stats?.length && !(t.surface === "enterprise" || t.surface === "workbench" && h.value.activeTab === "develop") ? (f(), v("section", Zv, [
                (f(!0), v(T, null, D(h.value.stats || [], (l) => (f(), v("article", {
                  key: l.label,
                  class: $(["ox-vite-stat-card", { emphasis: l.emphasis }])
                }, [
                  n("span", null, o(l.label), 1),
                  n("strong", null, o(l.value), 1),
                  n("small", null, o(l.meta), 1)
                ], 2))), 128))
              ])) : q("", !0),
              t.surface === "deploy" ? (f(), v(T, { key: 3 }, [
                h.value.activeTab === "table_pet" ? (f(), v("section", eg, [
                  n("article", tg, [
                    n("div", ng, [
                      n("h2", null, o(c.value ? "VRM 模型与在线状态" : "VRM Model & Runtime"), 1),
                      n("p", null, o(c.value ? "桌宠入口承接模型、动作和窗口设置，是最接近数字生命表现层的部署面。" : "The desktop-pet lane holds model, motion, and window settings for the most embodied deployment surface."), 1)
                    ]),
                    n("div", sg, [
                      n("div", lg, [
                        n("span", og, o(c.value ? "当前状态" : "Current state"), 1),
                        n("strong", null, o(h.value.deskPet?.status), 1),
                        n("p", null, o(c.value ? "建议先确认模型、表情和动作，再启动桌宠窗口。" : "Confirm the model, expressions, and motion set before launching the pet window."), 1)
                      ]),
                      n("div", ig, [
                        n("span", null, o(c.value ? "当前模型" : "Current Model"), 1),
                        n("strong", null, o(h.value.deskPet?.modelId), 1),
                        n("small", null, o(h.value.deskPet?.userModels) + " " + o(c.value ? "个自定义模型" : "custom models"), 1)
                      ])
                    ]),
                    n("div", ag, [
                      n("label", rg, [
                        n("span", null, o(c.value ? "表情驱动" : "Expressions"), 1),
                        n("input", {
                          value: h.value.deskPet?.expressions,
                          disabled: "",
                          type: "text"
                        }, null, 8, cg)
                      ]),
                      n("label", ug, [
                        n("span", null, o(c.value ? "动作驱动" : "Motions"), 1),
                        n("input", {
                          value: h.value.deskPet?.motions,
                          disabled: "",
                          type: "text"
                        }, null, 8, dg)
                      ]),
                      n("label", pg, [
                        n("span", null, o(c.value ? "窗口宽度" : "Window Width"), 1),
                        n("input", {
                          value: String(h.value.deskPet?.width || 0),
                          disabled: "",
                          type: "text"
                        }, null, 8, fg)
                      ]),
                      n("label", vg, [
                        n("span", null, o(c.value ? "窗口高度" : "Window Height"), 1),
                        n("input", {
                          value: String(h.value.deskPet?.height || 0),
                          disabled: "",
                          type: "text"
                        }, null, 8, gg)
                      ])
                    ])
                  ]),
                  n("article", mg, [
                    n("div", _g, [
                      n("h2", null, o(c.value ? "动作与表现" : "Motion & Presence"), 1),
                      n("p", null, o(c.value ? "后续会继续补齐待机动画、触摸反应和桌面漫游的可视化配置。" : "The next pass will deepen idle motion, touch reactions, and desktop roaming controls."), 1)
                    ]),
                    n("div", hg, [
                      n("span", yg, [
                        r[90] || (r[90] = n("i", { class: "fa-solid fa-face-smile" }, null, -1)),
                        et(o(h.value.deskPet?.expressions), 1)
                      ]),
                      n("span", bg, [
                        r[91] || (r[91] = n("i", { class: "fa-solid fa-person-running" }, null, -1)),
                        et(o(h.value.deskPet?.motionCount) + " " + o(c.value ? "个已选动作" : "selected motions"), 1)
                      ]),
                      n("span", xg, [
                        r[92] || (r[92] = n("i", { class: "fa-solid fa-window-maximize" }, null, -1)),
                        et(o(h.value.deskPet?.width) + " x " + o(h.value.deskPet?.height), 1)
                      ])
                    ])
                  ])
                ])) : h.value.activeTab === "im_bot" ? (f(), v("section", Sg, [
                  (f(!0), v(T, null, D(h.value.imChannels || [], (l) => (f(), v("article", {
                    key: l.id,
                    class: "ox-vite-deploy-platform-card"
                  }, [
                    n("div", kg, [
                      n("div", null, [
                        n("h3", null, o(l.label), 1),
                        n("p", null, o(l.agent), 1)
                      ]),
                      n("span", wg, o(l.status), 1)
                    ]),
                    n("div", Cg, [
                      n("span", null, o(l.memory), 1),
                      n("span", null, o(l.note), 1)
                    ])
                  ]))), 128))
                ])) : h.value.activeTab === "live_stream" ? (f(), v("section", Mg, [
                  n("article", Rg, [
                    n("div", Tg, [
                      n("h2", null, o(c.value ? "直播平台路由" : "Streaming Routes"), 1),
                      n("p", null, o(c.value ? "当前直播工作面统一管理 Bilibili、YouTube 和 Twitch 的启用状态与入口。" : "The live lane tracks Bilibili, YouTube, and Twitch enablement and entry points together."), 1)
                    ]),
                    n("div", Eg, [
                      (f(!0), v(T, null, D(h.value.liveChannels || [], (l) => (f(), v("article", {
                        key: l.id,
                        class: "ox-vite-deploy-platform-card"
                      }, [
                        n("div", Pg, [
                          n("div", null, [
                            n("h3", null, o(l.label), 1),
                            n("p", null, o(l.note), 1)
                          ]),
                          n("span", Ag, o(l.status), 1)
                        ])
                      ]))), 128))
                    ])
                  ]),
                  n("article", Dg, [
                    n("div", Ig, [
                      n("h2", null, o(c.value ? "互动与渲染输出" : "Interaction & Render Output"), 1),
                      n("p", null, o(c.value ? "把弹幕队列、唤醒词和 OBS 连接地址放在同一块，便于直播场景快速核对。" : "Keep danmaku flow, wake words, and OBS output together for faster stream checks."), 1)
                    ]),
                    n("div", Vg, [
                      n("label", Og, [
                        n("span", null, o(c.value ? "运行状态" : "Runtime"), 1),
                        n("input", {
                          value: h.value.liveStrategy?.runtime,
                          disabled: "",
                          type: "text"
                        }, null, 8, $g)
                      ]),
                      n("label", Fg, [
                        n("span", null, o(c.value ? "弹幕优先模式" : "Danmaku Only"), 1),
                        n("input", {
                          value: h.value.liveStrategy?.danmakuOnly,
                          disabled: "",
                          type: "text"
                        }, null, 8, Ng)
                      ]),
                      n("label", Lg, [
                        n("span", null, o(c.value ? "队列上限" : "Queue Limit"), 1),
                        n("input", {
                          value: String(h.value.liveStrategy?.queueLimit || 0),
                          disabled: "",
                          type: "text"
                        }, null, 8, jg)
                      ]),
                      n("label", Bg, [
                        n("span", null, o(c.value ? "唤醒词" : "Wake Word"), 1),
                        n("input", {
                          value: h.value.liveStrategy?.wakeWord,
                          disabled: "",
                          type: "text"
                        }, null, 8, Wg)
                      ]),
                      n("label", Ug, [
                        r[93] || (r[93] = n("span", null, "OBS", -1)),
                        n("input", {
                          value: h.value.liveStrategy?.obsUrl,
                          disabled: "",
                          type: "text"
                        }, null, 8, Kg)
                      ])
                    ])
                  ])
                ])) : h.value.activeTab === "read_bot" ? (f(), v("section", Hg, [
                  n("article", qg, [
                    n("div", zg, [
                      n("h2", null, o(c.value ? "朗读任务" : "Reading Job"), 1),
                      n("p", null, o(c.value ? "集中看选中文件、切片数量和朗读进度，比在旧页面里来回跳更清楚。" : "Keep file selection, segment counts, and reading progress visible in one place."), 1)
                    ]),
                    n("div", Yg, [
                      n("label", Gg, [
                        n("span", null, o(c.value ? "当前文件" : "Selected File"), 1),
                        n("input", {
                          value: h.value.readBot?.selectedFile,
                          disabled: "",
                          type: "text"
                        }, null, 8, Qg)
                      ]),
                      n("label", Xg, [
                        n("span", null, o(c.value ? "运行状态" : "Runtime"), 1),
                        n("input", {
                          value: h.value.readBot?.runtime,
                          disabled: "",
                          type: "text"
                        }, null, 8, Jg)
                      ]),
                      n("label", Zg, [
                        n("span", null, o(c.value ? "音频状态" : "Audio State"), 1),
                        n("input", {
                          value: h.value.readBot?.audioState,
                          disabled: "",
                          type: "text"
                        }, null, 8, em)
                      ])
                    ]),
                    n("div", tm, [
                      n("span", nm, [
                        r[94] || (r[94] = n("i", { class: "fa-solid fa-waveform" }, null, -1)),
                        et(o(h.value.readBot?.segments) + " " + o(c.value ? "段内容" : "segments"), 1)
                      ])
                    ])
                  ]),
                  n("article", sm, [
                    n("div", lm, [
                      n("h2", null, o(c.value ? "内容预览" : "Content Preview"), 1)
                    ]),
                    n("div", om, o(h.value.readBot?.preview), 1)
                  ])
                ])) : h.value.activeTab === "translate_bot" ? (f(), v("section", im, [
                  n("article", am, [
                    n("div", rm, [
                      n("h2", null, o(c.value ? "翻译输入" : "Translation Input"), 1),
                      n("p", null, o(c.value ? "目标语言、源文本长度和翻译状态已经挂到新的工作面里。" : "Target language, source length, and translation status now live on the new workbench."), 1)
                    ]),
                    n("div", cm, [
                      n("label", um, [
                        n("span", null, o(c.value ? "目标语言" : "Target Language"), 1),
                        n("input", {
                          value: h.value.translateBot?.runtime,
                          disabled: "",
                          type: "text"
                        }, null, 8, dm)
                      ]),
                      n("label", pm, [
                        n("span", null, o(c.value ? "翻译状态" : "Translation Status"), 1),
                        n("input", {
                          value: h.value.translateBot?.busy ? c.value ? "翻译中" : "Translating" : c.value ? "待处理" : "Idle",
                          disabled: "",
                          type: "text"
                        }, null, 8, fm)
                      ])
                    ]),
                    n("div", vm, [
                      n("span", gm, [
                        r[95] || (r[95] = n("i", { class: "fa-solid fa-align-left" }, null, -1)),
                        et(o(h.value.translateBot?.sourceLength) + " " + o(c.value ? "字符输入" : "source chars"), 1)
                      ]),
                      n("span", mm, [
                        r[96] || (r[96] = n("i", { class: "fa-solid fa-language" }, null, -1)),
                        et(o(h.value.translateBot?.targetLength) + " " + o(c.value ? "字符输出" : "target chars"), 1)
                      ])
                    ])
                  ]),
                  n("article", _m, [
                    n("div", hm, [
                      n("h2", null, o(c.value ? "源文本预览" : "Source Preview"), 1)
                    ]),
                    n("div", ym, o(h.value.translateBot?.sourcePreview), 1)
                  ]),
                  n("article", bm, [
                    n("div", xm, [
                      n("h2", null, o(c.value ? "译文预览" : "Result Preview"), 1)
                    ]),
                    n("div", Sm, o(h.value.translateBot?.resultPreview), 1)
                  ])
                ])) : (f(), v("section", km, [
                  n("article", wm, [
                    n("div", Cm, [
                      n("h2", null, o(c.value ? "图床与素材出口" : "Media Outputs"), 1),
                      n("p", null, o(c.value ? "这一块是多个机器人共用的出口配置，先把图床和仓库回退整理清楚。" : "These shared output routes affect multiple bots, so host and fallback setup should stay explicit."), 1)
                    ]),
                    n("div", Mm, [
                      n("label", Rm, [
                        n("span", null, o(c.value ? "图床状态" : "Media Host"), 1),
                        n("input", {
                          value: h.value.generalConfig?.mediaHostEnabled,
                          disabled: "",
                          type: "text"
                        }, null, 8, Tm)
                      ]),
                      n("label", Em, [
                        n("span", null, o(c.value ? "当前图床" : "Selected Host"), 1),
                        n("input", {
                          value: h.value.generalConfig?.mediaHost,
                          disabled: "",
                          type: "text"
                        }, null, 8, Pm)
                      ]),
                      n("label", Am, [
                        r[97] || (r[97] = n("span", null, "EasyImage2", -1)),
                        n("input", {
                          value: h.value.generalConfig?.easyImage,
                          disabled: "",
                          type: "text"
                        }, null, 8, Dm)
                      ]),
                      n("label", Im, [
                        r[98] || (r[98] = n("span", null, "GitHub", -1)),
                        n("input", {
                          value: h.value.generalConfig?.githubRepo,
                          disabled: "",
                          type: "text"
                        }, null, 8, Vm)
                      ]),
                      n("label", Om, [
                        r[99] || (r[99] = n("span", null, "Gitee", -1)),
                        n("input", {
                          value: h.value.generalConfig?.giteeRepo,
                          disabled: "",
                          type: "text"
                        }, null, 8, $m)
                      ])
                    ])
                  ])
                ]))
              ], 64)) : t.surface === "workbench" ? (f(), v(T, { key: 4 }, [
                h.value.activeTab === "develop" ? (f(), v(T, { key: 0 }, [
                  n("section", Fm, [
                    (f(!0), v(T, null, D(h.value.topStats || [], (l) => (f(), v("article", {
                      key: l.label,
                      class: $(["ox-vite-stat-card", { emphasis: l.emphasis }])
                    }, [
                      n("span", null, o(l.label), 1),
                      n("strong", null, o(l.value), 1),
                      n("small", null, o(l.note), 1)
                    ], 2))), 128))
                  ]),
                  n("section", Nm, [
                    n("p", null, o(c.value ? "把计划、差异分析、Provider 修复、工作区映射与任务中心收束到同一个开发控制台。" : "Bring plan, diff analysis, provider repair, workspace mapping, and task follow-through into one developer control surface."), 1),
                    n("div", Lm, [
                      n("div", null, [
                        n("strong", null, o(c.value ? "工作流支持" : "Workflow Support"), 1),
                        n("div", jm, [
                          (f(!0), v(T, null, D(h.value.workflowSupport || [], (l) => (f(), v("span", {
                            key: l.id,
                            class: $(["ox-vite-detail-chip", { "is-disabled": !l.enabled }])
                          }, [
                            n("i", {
                              class: $(l.enabled ? "fa-solid fa-circle-check" : "fa-regular fa-circle")
                            }, null, 2),
                            n("span", null, o(l.label), 1)
                          ], 2))), 128))
                        ])
                      ]),
                      n("div", null, [
                        n("strong", null, o(c.value ? "能力摘要" : "Capability Summary"), 1),
                        n("div", Bm, [
                          (f(!0), v(T, null, D(h.value.capabilitySummary || [], (l) => (f(), v("span", {
                            key: l.id,
                            class: $(["ox-vite-detail-chip", { "is-disabled": !l.enabled }])
                          }, [
                            n("i", {
                              class: $(l.enabled ? "fa-solid fa-square-check" : "fa-regular fa-square")
                            }, null, 2),
                            n("span", null, o(l.label), 1)
                          ], 2))), 128))
                        ])
                      ])
                    ])
                  ]),
                  n("section", Wm, [
                    n("article", Um, [
                      n("div", Km, [
                        n("h2", null, o(c.value ? "模型服务商" : "Provider Setup"), 1),
                        n("p", null, o(h.value.providerCard?.message || (c.value ? "本地 OpenXnet Runtime 与模型服务的主要接入点。" : "Primary entry for the desktop runtime and model provider integration.")), 1)
                      ]),
                      n("div", Hm, [
                        n("span", qm, o(h.value.providerCard?.status || "-"), 1),
                        n("span", zm, o(h.value.providerCard?.apiKeyConfigured ? c.value ? "已配置 API Key" : "API key configured" : c.value ? "缺少 API Key" : "API key missing"), 1),
                        n("span", Ym, o(h.value.providerCard?.providerCount) + " " + o(c.value ? "个 provider 选项" : "provider options"), 1)
                      ]),
                      n("div", Gm, [
                        n("label", Qm, [
                          n("span", null, o((c.value, "Vendor")), 1),
                          n("input", {
                            value: h.value.providerCard?.vendor,
                            disabled: "",
                            type: "text"
                          }, null, 8, Xm)
                        ]),
                        n("label", Jm, [
                          n("span", null, o(c.value ? "模型" : "Model"), 1),
                          n("input", {
                            value: h.value.providerCard?.model,
                            disabled: "",
                            type: "text"
                          }, null, 8, Zm)
                        ]),
                        n("label", e_, [
                          r[100] || (r[100] = n("span", null, "URL", -1)),
                          n("input", {
                            value: h.value.providerCard?.url,
                            disabled: "",
                            type: "text"
                          }, null, 8, t_)
                        ])
                      ]),
                      h.value.providerCard?.validationMessage ? (f(), v("div", n_, o(h.value.providerCard?.validationMessage), 1)) : q("", !0)
                    ]),
                    n("article", s_, [
                      n("div", l_, [
                        n("h2", null, o(c.value ? "OpenXnet-Server 网关" : "Gateway Provider"), 1),
                        n("p", null, o(h.value.gatewayCard?.message || (c.value ? "用于服务端 profile 的模型接入和网关治理。" : "Provider access and gateway governance for the server profile.")), 1)
                      ]),
                      n("div", o_, [
                        n("span", i_, o(h.value.gatewayCard?.enabled ? c.value ? "已启用" : "Enabled" : c.value ? "未启用" : "Disabled"), 1),
                        n("span", a_, o(h.value.gatewayCard?.reachable ? c.value ? "可达" : "Reachable" : c.value ? "不可达" : "Unreachable"), 1),
                        n("span", r_, o(h.value.gatewayCard?.providerCount) + " " + o(c.value ? "个 provider 选项" : "provider options"), 1)
                      ]),
                      n("div", c_, [
                        n("label", u_, [
                          n("span", null, o((c.value, "Vendor")), 1),
                          n("input", {
                            value: h.value.gatewayCard?.vendor,
                            disabled: "",
                            type: "text"
                          }, null, 8, d_)
                        ]),
                        n("label", p_, [
                          n("span", null, o(c.value ? "模型" : "Model"), 1),
                          n("input", {
                            value: h.value.gatewayCard?.model,
                            disabled: "",
                            type: "text"
                          }, null, 8, f_)
                        ]),
                        n("label", v_, [
                          r[101] || (r[101] = n("span", null, "URL", -1)),
                          n("input", {
                            value: h.value.gatewayCard?.url,
                            disabled: "",
                            type: "text"
                          }, null, 8, g_)
                        ]),
                        n("label", m_, [
                          n("span", null, o(c.value ? "管理地址" : "Management URL"), 1),
                          n("input", {
                            value: h.value.gatewayCard?.managementUrl || "-",
                            disabled: "",
                            type: "text"
                          }, null, 8, __)
                        ])
                      ])
                    ]),
                    n("article", h_, [
                      n("div", y_, [
                        n("h2", null, o(c.value ? "默认映射" : "Default Mapping"), 1),
                        n("p", null, o(h.value.mappingCard?.message || (c.value ? "主智能体、模型解析和 provider 映射应在这里先校准。" : "Tune the main agent, model resolution, and provider mapping here first.")), 1)
                      ]),
                      n("div", b_, [
                        n("article", x_, [
                          n("div", null, [
                            n("strong", null, o(c.value ? "主智能体" : "Main Agent"), 1)
                          ]),
                          n("span", null, o(h.value.mappingCard?.agent || "-"), 1)
                        ]),
                        n("article", S_, [
                          n("div", null, [
                            n("strong", null, o(c.value ? "当前模型" : "Current Model"), 1)
                          ]),
                          n("span", null, o(h.value.mappingCard?.currentModel || "-"), 1)
                        ]),
                        n("article", k_, [
                          n("div", null, [
                            n("strong", null, o(c.value ? "解析结果" : "Resolved Model"), 1)
                          ]),
                          n("span", null, o(h.value.mappingCard?.resolvedModel || "-"), 1)
                        ]),
                        n("article", w_, [
                          n("div", null, [
                            n("strong", null, o(c.value ? "解析来源" : "Resolution Source"), 1)
                          ]),
                          n("span", null, o(h.value.mappingCard?.resolutionSource || "-"), 1)
                        ])
                      ]),
                      n("div", C_, [
                        n("span", M_, o(h.value.mappingCard?.providerModelCount) + " " + o(c.value ? "个 provider 模型" : "provider models"), 1),
                        n("span", R_, o(h.value.mappingCard?.agentCount) + " " + o(c.value ? "个 agent 选项" : "agent options"), 1)
                      ])
                    ]),
                    n("article", T_, [
                      n("div", E_, [
                        n("h2", null, o(c.value ? "CLI 工作区" : "CLI Workspace"), 1),
                        n("p", null, o(h.value.workspaceCard?.message || (c.value ? "CLI 工作区路径、权限模式和可见范围决定后续开发动作的落点。" : "Workspace path, permission mode, and visibility scope define where later coding actions land.")), 1)
                      ]),
                      n("div", P_, [
                        n("span", A_, o(h.value.workspaceCard?.status || "-"), 1),
                        n("span", D_, o(h.value.workspaceCard?.exists ? c.value ? "路径存在" : "Path exists" : c.value ? "路径缺失" : "Path missing"), 1)
                      ]),
                      n("div", I_, [
                        n("label", V_, [
                          n("span", null, o(c.value ? "工作区路径" : "Workspace Path"), 1),
                          n("input", {
                            value: h.value.workspaceCard?.path,
                            disabled: "",
                            type: "text"
                          }, null, 8, O_)
                        ]),
                        n("label", $_, [
                          n("span", null, o(c.value ? "执行引擎" : "Engine"), 1),
                          n("input", {
                            value: h.value.workspaceCard?.engine,
                            disabled: "",
                            type: "text"
                          }, null, 8, F_)
                        ]),
                        n("label", N_, [
                          n("span", null, o(c.value ? "权限模式" : "Permission Mode"), 1),
                          n("input", {
                            value: h.value.workspaceCard?.permissionMode,
                            disabled: "",
                            type: "text"
                          }, null, 8, L_)
                        ]),
                        n("label", j_, [
                          n("span", null, o(c.value ? "可见范围" : "Visibility Scope"), 1),
                          n("input", {
                            value: h.value.workspaceCard?.visibilityScope,
                            disabled: "",
                            type: "text"
                          }, null, 8, B_)
                        ])
                      ]),
                      h.value.workspaceCard?.recommendedReason ? (f(), v("div", W_, o(h.value.workspaceCard?.recommendedReason), 1)) : q("", !0)
                    ])
                  ]),
                  n("section", U_, [
                    n("article", K_, [
                      n("div", H_, [
                        n("h2", null, o(c.value ? "配置就绪度" : "Configuration Readiness"), 1),
                        n("p", null, o(c.value ? "先把运行 Profile、模型接入和 CLI 工作区状态收敛清楚，再让后续任务持续落在正确轨道。" : "Clarify runtime profile, model access, and workspace state before letting later tasks run on the wrong track."), 1)
                      ]),
                      n("div", q_, [
                        (f(!0), v(T, null, D(h.value.readiness || [], (l) => (f(), v("article", {
                          key: l.id,
                          class: "ox-vite-list-row"
                        }, [
                          n("div", null, [
                            n("strong", null, o(l.label), 1),
                            n("p", null, o(l.note), 1)
                          ]),
                          n("span", z_, o(l.status), 1)
                        ]))), 128))
                      ])
                    ]),
                    n("article", Y_, [
                      n("div", G_, [
                        n("h2", null, o(c.value ? "最近开发任务" : "Recent Dev Tasks"), 1),
                        n("p", null, o(c.value ? "把开发流里最近提交的计划、Review 和 Patch 任务继续收束到同一工作面。" : "Keep recent plan, review, and patch tasks visible inside the same workbench."), 1)
                      ]),
                      n("div", Q_, [
                        (f(!0), v(T, null, D(h.value.recentTasks || [], (l) => (f(), v("article", {
                          key: l.id,
                          class: "ox-vite-list-row"
                        }, [
                          n("div", null, [
                            n("strong", null, o(l.title), 1),
                            n("p", null, o(l.workflow) + " · " + o(l.updatedAt), 1)
                          ]),
                          n("span", X_, o(l.status), 1)
                        ]))), 128)),
                        (h.value.recentTasks || []).length ? q("", !0) : (f(), v("article", J_, [
                          n("div", null, [
                            n("strong", null, o(c.value ? "还没有最近任务" : "No recent tasks yet"), 1),
                            n("p", null, o(c.value ? "等开发任务创建后，这里会开始沉淀最近活动。" : "Recent activity will appear here once dev tasks are created."), 1)
                          ])
                        ]))
                      ])
                    ]),
                    n("article", Z_, [
                      n("div", eh, [
                        n("h2", null, o(c.value ? "工作流模板" : "Workflow Templates"), 1),
                        n("p", null, o(c.value ? "这里会持续沉淀计划、Review、Diff 和 Patch 的工作模板。" : "This panel collects reusable templates for plan, review, diff, and patch workflows."), 1)
                      ]),
                      n("div", th, [
                        (f(!0), v(T, null, D(h.value.templates || [], (l) => (f(), v("article", {
                          key: l.id,
                          class: "ox-vite-list-row"
                        }, [
                          n("div", null, [
                            n("strong", null, o(l.title), 1),
                            n("p", null, o(l.summary || l.suggestedGoal || "-"), 1)
                          ]),
                          n("span", nh, o(l.id), 1)
                        ]))), 128)),
                        (h.value.templates || []).length ? q("", !0) : (f(), v("article", sh, [
                          n("div", null, [
                            n("strong", null, o(c.value ? "还没有模板" : "No templates yet"), 1),
                            n("p", null, o(c.value ? "模板加载完成后，会显示建议目标和默认工作流。" : "Templates will show suggested goals and default workflows once loaded."), 1)
                          ])
                        ]))
                      ])
                    ]),
                    n("article", lh, [
                      n("div", oh, [
                        n("h2", null, o(c.value ? "当前告警" : "Warnings"), 1),
                        n("p", null, o(c.value ? "阻塞项和注意事项应该集中出现在工作台里，而不是藏在设置深处。" : "Blockers and cautions should stay visible in the workbench instead of hiding deep in settings."), 1)
                      ]),
                      n("div", ih, [
                        (f(!0), v(T, null, D(h.value.warnings || [], (l, P) => (f(), v("article", {
                          key: `${P}-${l}`,
                          class: "ox-vite-list-row"
                        }, [
                          n("div", null, [
                            n("strong", null, o(c.value ? "注意事项" : "Warning"), 1),
                            n("p", null, o(l), 1)
                          ])
                        ]))), 128)),
                        (h.value.warnings || []).length ? q("", !0) : (f(), v("article", ah, [
                          n("div", null, [
                            n("strong", null, o(c.value ? "当前没有告警" : "No warnings right now"), 1),
                            n("p", null, o(c.value ? "当 provider、映射或工作区存在风险时，这里会优先显示。" : "Provider, mapping, or workspace issues will surface here first."), 1)
                          ])
                        ]))
                      ])
                    ])
                  ])
                ], 64)) : (f(), v("section", rh, [
                  n("article", ch, [
                    n("div", uh, [
                      n("h2", null, o(h.value.meta?.title), 1),
                      n("p", null, o(h.value.meta?.summary), 1)
                    ]),
                    n("div", dh, [
                      (f(!0), v(T, null, D(h.value.stats || [], (l) => (f(), v("article", {
                        key: l.label,
                        class: "ox-vite-list-row"
                      }, [
                        n("div", null, [
                          n("strong", null, o(l.label), 1),
                          n("p", null, o(l.meta), 1)
                        ]),
                        n("span", null, o(l.value), 1)
                      ]))), 128))
                    ])
                  ])
                ]))
              ], 64)) : t.surface === "enterprise" ? (f(), v(T, { key: 5 }, [
                n("section", ph, [
                  (f(!0), v(T, null, D(h.value.topStats || [], (l) => (f(), v("article", {
                    key: l.title,
                    class: "ox-vite-stat-card"
                  }, [
                    n("span", null, o(l.title), 1),
                    n("strong", null, o(l.value), 1),
                    n("small", null, o(l.note), 1)
                  ]))), 128))
                ]),
                n("section", fh, [
                  n("p", null, o(h.value.meta?.summary), 1),
                  n("div", vh, [
                    (f(!0), v(T, null, D(h.value.meta?.chips || [], (l) => (f(), v("span", {
                      key: l.icon + l.text,
                      class: "ox-vite-detail-chip"
                    }, [
                      n("i", {
                        class: $(l.icon)
                      }, null, 2),
                      n("span", null, o(l.text), 1)
                    ]))), 128))
                  ])
                ]),
                h.value.activeTab === "usage" ? (f(), v(T, { key: 0 }, [
                  n("section", gh, [
                    (f(!0), v(T, null, D(h.value.usagePanel?.metrics || [], (l) => (f(), v("article", {
                      key: l.label,
                      class: "ox-vite-stat-card"
                    }, [
                      n("span", null, o(l.label), 1),
                      n("strong", null, o(l.value), 1)
                    ]))), 128))
                  ]),
                  n("section", mh, [
                    n("article", _h, [
                      n("div", hh, [
                        n("h2", null, o(c.value ? "用量趋势" : "Usage Trend"), 1),
                        n("p", null, o(c.value ? "这里先把近期 token 变化做成轻量条形视图，后续继续贴近原型中的图表层次。" : "A lightweight token trend view for now, with a closer chart treatment coming next."), 1)
                      ]),
                      n("div", yh, [
                        (f(!0), v(T, null, D(h.value.usagePanel?.trend || [], (l) => (f(), v("div", {
                          key: l.id,
                          class: "ox-vite-mini-bars__item"
                        }, [
                          n("div", {
                            class: "ox-vite-mini-bars__bar",
                            style: rt({ height: `${Math.max(10, Math.min(100, l.value ? l.value / Math.max(...(h.value.usagePanel?.trend || []).map((P) => P.value || 0), 1) * 100 : 10))}%` })
                          }, null, 4),
                          n("span", null, o(l.label), 1)
                        ]))), 128))
                      ])
                    ]),
                    n("article", bh, [
                      n("div", xh, [
                        n("h2", null, o(c.value ? "模型用量" : "Usage by Model"), 1)
                      ]),
                      n("div", Sh, [
                        (f(!0), v(T, null, D(h.value.usagePanel?.models || [], (l) => (f(), v("article", {
                          key: l.id,
                          class: "ox-vite-list-row"
                        }, [
                          n("div", null, [
                            n("strong", null, o(l.name), 1),
                            n("p", null, o(l.requests) + " " + o(c.value ? "次请求" : "requests"), 1)
                          ]),
                          n("span", null, o(l.tokens) + " tokens · $" + o(l.cost.toFixed(4)), 1)
                        ]))), 128))
                      ])
                    ])
                  ]),
                  n("section", kh, [
                    n("div", wh, [
                      n("h2", null, o(c.value ? "用户用量" : "Usage by User"), 1)
                    ]),
                    n("div", Ch, [
                      (f(!0), v(T, null, D(h.value.usagePanel?.users || [], (l) => (f(), v("article", {
                        key: l.id,
                        class: "ox-vite-list-row"
                      }, [
                        n("div", null, [
                          n("strong", null, o(l.name), 1),
                          n("p", null, o(l.requests) + " " + o(c.value ? "次请求" : "requests"), 1)
                        ]),
                        n("span", null, o(l.tokens) + " tokens · " + o(l.latency) + "ms", 1)
                      ]))), 128))
                    ])
                  ])
                ], 64)) : h.value.activeTab === "neuro" ? (f(), v(T, { key: 1 }, [
                  n("section", Mh, [
                    (f(!0), v(T, null, D(h.value.neuroPanel?.metrics || [], (l) => (f(), v("article", {
                      key: l.label,
                      class: "ox-vite-stat-card"
                    }, [
                      n("span", null, o(l.label), 1),
                      n("strong", null, o(l.value), 1)
                    ]))), 128))
                  ]),
                  n("section", Rh, [
                    n("article", Th, [
                      n("div", Eh, [
                        n("h2", null, o(c.value ? "神经符号" : "Symbols"), 1)
                      ]),
                      n("div", Ph, [
                        (f(!0), v(T, null, D(h.value.neuroPanel?.symbols || [], (l) => (f(), v("article", {
                          key: l.id,
                          class: "ox-vite-list-row"
                        }, [
                          n("div", null, [
                            n("strong", null, o(l.label), 1),
                            n("p", null, o(l.operator) + " · " + o(l.entities.join(", ") || "-"), 1)
                          ]),
                          n("span", null, o(Math.round(l.successRate * 100)) + "% · " + o(l.activations), 1)
                        ]))), 128))
                      ])
                    ]),
                    n("article", Ah, [
                      n("div", Dh, [
                        n("h2", null, o(c.value ? "认知规则" : "Cognitive Rules"), 1)
                      ]),
                      n("div", Ih, [
                        (f(!0), v(T, null, D(h.value.neuroPanel?.rules || [], (l) => (f(), v("article", {
                          key: l.id,
                          class: "ox-vite-list-row"
                        }, [
                          n("div", null, [
                            n("strong", null, o(l.name), 1),
                            n("p", null, o(l.domain) + " · " + o(l.description), 1)
                          ]),
                          n("span", null, o(l.enabled ? "ON" : "OFF"), 1)
                        ]))), 128))
                      ])
                    ])
                  ])
                ], 64)) : h.value.activeTab === "kg" ? (f(), v(T, { key: 2 }, [
                  n("section", Vh, [
                    (f(!0), v(T, null, D(h.value.kgPanel?.metrics || [], (l) => (f(), v("article", {
                      key: l.label,
                      class: "ox-vite-stat-card"
                    }, [
                      n("span", null, o(l.label), 1),
                      n("strong", null, o(l.value), 1)
                    ]))), 128))
                  ]),
                  n("section", Oh, [
                    n("div", $h, [
                      n("h2", null, o(c.value ? "实体事实" : "Entity Facts"), 1),
                      n("p", null, o(c.value ? "这一层先把知识图谱查询结果收束成可读列表，后续再继续贴近图谱可视化原型。" : "This pass keeps graph query results readable first, with a more visual graph view to follow."), 1)
                    ]),
                    n("div", Fh, [
                      (f(!0), v(T, null, D(h.value.kgPanel?.facts || [], (l) => (f(), v("article", {
                        key: l.id,
                        class: "ox-vite-list-row"
                      }, [
                        n("div", null, [
                          n("strong", null, o(l.subject), 1),
                          n("p", null, o(l.predicate), 1)
                        ]),
                        n("span", null, o(l.object), 1)
                      ]))), 128)),
                      (h.value.kgPanel?.facts || []).length ? q("", !0) : (f(), v("article", Nh, [
                        n("div", null, [
                          n("strong", null, o(c.value ? "当前没有实体事实" : "No entity facts yet"), 1),
                          n("p", null, o(c.value ? "当图谱实体查询成功后，结果会先沉淀在这里。" : "Facts will appear here once entity queries return data."), 1)
                        ])
                      ]))
                    ])
                  ])
                ], 64)) : h.value.activeTab === "enterprise-kb" ? (f(), v("section", Lh, [
                  n("section", jh, [
                    n("div", Bh, [
                      n("div", Wh, o(c.value ? "企业知识库" : "Enterprise Knowledge"), 1),
                      n("h2", null, o(c.value ? "统一管理知识库、分类与文档沉淀" : "Manage knowledge bases, categories, and document coverage in one place"), 1),
                      n("p", null, o(c.value ? "把知识库、分类、文档规模和版本演进收束进同一条企业工作流，便于团队共享知识和后续接入知识图谱。" : "Keep knowledge bases, categories, document scale, and version history aligned in one enterprise workflow."), 1)
                    ]),
                    n("div", Uh, [
                      n("article", Kh, [
                        n("span", null, o(zt.value.totalCount || (zt.value.items || []).length), 1),
                        n("small", null, o(c.value ? "知识库" : "KBs"), 1)
                      ]),
                      n("article", Hh, [
                        n("span", null, o(zt.value.totalDocs || 0), 1),
                        n("small", null, o(c.value ? "文档总量" : "Docs"), 1)
                      ]),
                      n("article", qh, [
                        n("span", null, o(xs.value.length - 1), 1),
                        n("small", null, o(c.value ? "分类" : "Categories"), 1)
                      ])
                    ])
                  ]),
                  n("section", zh, [
                    n("div", Yh, [
                      r[103] || (r[103] = n("i", { class: "fa-solid fa-magnifying-glass" }, null, -1)),
                      Te(n("input", {
                        "onUpdate:modelValue": r[19] || (r[19] = (l) => ft.value = l),
                        type: "text",
                        placeholder: c.value ? "搜索知识库名称、分类或描述" : "Search KB name, category, or description"
                      }, null, 8, Gh), [
                        [je, ft.value]
                      ]),
                      ft.value ? (f(), v("button", {
                        key: 0,
                        type: "button",
                        class: "ox-vite-role-search__clear",
                        onClick: r[20] || (r[20] = (l) => ft.value = "")
                      }, [...r[102] || (r[102] = [
                        n("i", { class: "fa-solid fa-xmark" }, null, -1)
                      ])])) : q("", !0)
                    ]),
                    n("button", {
                      type: "button",
                      class: "ox-vite-ops-primary-btn",
                      onClick: Pi
                    }, [
                      r[104] || (r[104] = n("i", { class: "fa-solid fa-plus" }, null, -1)),
                      n("span", null, o(c.value ? "新建知识库" : "Create KB"), 1)
                    ])
                  ]),
                  n("section", Qh, [
                    (f(!0), v(T, null, D(xs.value, (l) => (f(), v("button", {
                      key: l.id,
                      type: "button",
                      class: $(["ox-vite-role-category-chip", { "is-active": lt.value === l.id }]),
                      onClick: (P) => lt.value = l.id
                    }, [
                      n("span", null, o(l.label), 1),
                      n("strong", null, o(l.id === "all" ? (zt.value.items || []).length : (zt.value.items || []).filter((P) => P.category === l.id).length), 1)
                    ], 10, Xh))), 128))
                  ]),
                  n("section", Jh, [
                    n("article", Zh, [
                      n("div", ey, [
                        n("div", null, [
                          n("div", ty, o(c.value ? "知识库列表" : "Knowledge Base Library"), 1),
                          n("h2", null, o(c.value ? "当前企业知识库" : "Current Enterprise Knowledge Bases"), 1)
                        ]),
                        n("div", ny, o(Ss.value.length), 1)
                      ]),
                      Ss.value.length ? (f(), v("div", sy, [
                        (f(!0), v(T, null, D(Ss.value, (l) => (f(), v("article", {
                          key: l.id,
                          class: "ox-vite-kb-card"
                        }, [
                          n("div", ly, [
                            n("div", oy, [
                              r[105] || (r[105] = n("div", { class: "ox-vite-kb-card__icon" }, [
                                n("i", { class: "fa-solid fa-book-open" })
                              ], -1)),
                              n("div", null, [
                                n("div", iy, o(l.name), 1),
                                n("div", ay, o(l.category), 1)
                              ])
                            ]),
                            n("span", ry, o(l.docs) + " " + o(c.value ? "篇文档" : "docs"), 1)
                          ]),
                          n("p", null, o(l.description || (c.value ? "当前知识库还没有补充描述。" : "No KB description yet.")), 1),
                          n("div", cy, [
                            l.updatedAt ? (f(), v("span", uy, o(l.updatedAt), 1)) : q("", !0)
                          ]),
                          n("div", dy, [
                            n("button", {
                              type: "button",
                              class: "ox-vite-ops-secondary-btn",
                              onClick: (P) => Ai(l)
                            }, [
                              r[106] || (r[106] = n("i", { class: "fa-solid fa-pen" }, null, -1)),
                              n("span", null, o(c.value ? "编辑" : "Edit"), 1)
                            ], 8, py),
                            n("button", {
                              type: "button",
                              class: "ox-vite-ops-secondary-btn",
                              onClick: (P) => Ki(l)
                            }, [
                              r[107] || (r[107] = n("i", { class: "fa-solid fa-clock-rotate-left" }, null, -1)),
                              n("span", null, o(c.value ? "版本" : "Versions"), 1)
                            ], 8, fy),
                            n("button", {
                              type: "button",
                              class: "ox-vite-ops-secondary-btn",
                              onClick: (P) => Ii(l)
                            }, [
                              r[108] || (r[108] = n("i", { class: "fa-regular fa-trash-can" }, null, -1)),
                              n("span", null, o(c.value ? "删除" : "Delete"), 1)
                            ], 8, vy)
                          ])
                        ]))), 128))
                      ])) : (f(), v("div", gy, [
                        r[109] || (r[109] = n("i", { class: "fa-solid fa-book-open" }, null, -1)),
                        n("strong", null, o(c.value ? "还没有知识库" : "No knowledge bases yet"), 1),
                        n("p", null, o(c.value ? "先创建一个知识库，后续再继续承接文档上传和版本演进。" : "Create the first KB, then continue with docs and version flows."), 1)
                      ]))
                    ]),
                    n("aside", my, [
                      vt.value === "editor" && Ae.value ? (f(), v(T, { key: 0 }, [
                        n("div", _y, [
                          n("div", null, [
                            n("div", hy, o(c.value ? "知识库编辑器" : "KB Editor"), 1),
                            n("h2", null, o(Me.value.id ? c.value ? "编辑知识库" : "Edit Knowledge Base" : c.value ? "新建知识库" : "Create Knowledge Base"), 1)
                          ])
                        ]),
                        n("div", yy, [
                          n("label", by, [
                            n("span", null, o(c.value ? "知识库名称" : "KB Name"), 1),
                            Te(n("input", {
                              "onUpdate:modelValue": r[21] || (r[21] = (l) => Me.value.name = l),
                              type: "text"
                            }, null, 512), [
                              [je, Me.value.name]
                            ])
                          ]),
                          n("label", xy, [
                            n("span", null, o(c.value ? "分类" : "Category"), 1),
                            Te(n("input", {
                              "onUpdate:modelValue": r[22] || (r[22] = (l) => Me.value.category = l),
                              type: "text"
                            }, null, 512), [
                              [je, Me.value.category]
                            ])
                          ]),
                          n("label", Sy, [
                            n("span", null, o(c.value ? "描述" : "Description"), 1),
                            Te(n("input", {
                              "onUpdate:modelValue": r[23] || (r[23] = (l) => Me.value.description = l),
                              type: "text"
                            }, null, 512), [
                              [je, Me.value.description]
                            ])
                          ])
                        ]),
                        n("div", ky, [
                          n("button", {
                            type: "button",
                            class: "ox-vite-ops-secondary-btn",
                            onClick: r[24] || (r[24] = (l) => {
                              Ae.value = !1, vt.value = "summary";
                            })
                          }, [
                            r[110] || (r[110] = n("i", { class: "fa-solid fa-xmark" }, null, -1)),
                            n("span", null, o(c.value ? "取消" : "Cancel"), 1)
                          ]),
                          n("button", {
                            type: "button",
                            class: "ox-vite-ops-primary-btn",
                            disabled: !Me.value.name,
                            onClick: Di
                          }, [
                            r[111] || (r[111] = n("i", { class: "fa-solid fa-check" }, null, -1)),
                            n("span", null, o(Me.value.id ? c.value ? "保存" : "Save" : c.value ? "创建" : "Create"), 1)
                          ], 8, wy)
                        ])
                      ], 64)) : vt.value === "versions" && Nt.value ? (f(), v(T, { key: 1 }, [
                        n("div", Cy, [
                          n("div", null, [
                            n("div", My, o(c.value ? "版本历史" : "Version History"), 1),
                            n("h2", null, o(c.value ? "知识库版本演进" : "Knowledge Base Revisions"), 1)
                          ])
                        ]),
                        Ht.value.length ? (f(), v("div", Ry, [
                          (f(!0), v(T, null, D(Ht.value, (l, P) => (f(), v("article", {
                            key: `${l.version || P}`,
                            class: "ox-vite-list-row"
                          }, [
                            n("div", null, [
                              n("strong", null, "v" + o(l.version || P + 1), 1),
                              n("p", null, o(l.created_at || (c.value ? "暂无时间信息" : "No timestamp")), 1)
                            ]),
                            n("span", null, o(l.doc_count || 0) + " " + o(c.value ? "篇文档" : "docs"), 1)
                          ]))), 128))
                        ])) : (f(), v("div", Ty, [
                          r[112] || (r[112] = n("i", { class: "fa-solid fa-clock-rotate-left" }, null, -1)),
                          n("strong", null, o(c.value ? "暂无版本历史" : "No version history yet"), 1)
                        ])),
                        n("div", Ey, [
                          n("button", {
                            type: "button",
                            class: "ox-vite-ops-secondary-btn",
                            onClick: r[25] || (r[25] = (l) => {
                              Nt.value = !1, vt.value = "summary";
                            })
                          }, [
                            r[113] || (r[113] = n("i", { class: "fa-solid fa-arrow-left" }, null, -1)),
                            n("span", null, o(c.value ? "返回" : "Back"), 1)
                          ])
                        ])
                      ], 64)) : (f(), v(T, { key: 2 }, [
                        n("div", Py, [
                          n("div", null, [
                            n("div", Ay, o(c.value ? "知识工程提示" : "Knowledge Engineering Notes"), 1),
                            n("h2", null, o(c.value ? "先把知识库沉淀成稳定入口" : "Turn KBs into a stable operating surface first"), 1)
                          ])
                        ]),
                        n("div", Dy, [
                          n("article", Iy, [
                            n("div", null, [
                              n("strong", null, o(c.value ? "分类先于扩张" : "Categorize before scaling"), 1),
                              n("p", null, o(c.value ? "先让知识库有清晰分类和描述，再继续接文档上传和图谱关系。" : "Give each KB a clear category and scope before expanding into files and graph links."), 1)
                            ])
                          ]),
                          n("article", Vy, [
                            n("div", null, [
                              n("strong", null, o(c.value ? "版本历史保留审计线" : "Version history preserves the audit trail"), 1),
                              n("p", null, o(c.value ? "后续继续细化版本差异、回滚和文档批次信息。" : "The next pass can deepen version diff, rollback, and document batch details."), 1)
                            ])
                          ])
                        ])
                      ], 64))
                    ])
                  ])
                ])) : h.value.activeTab === "staff-roles" ? (f(), v("section", Oy, [
                  n("section", $y, [
                    n("div", Fy, [
                      n("div", Ny, o(c.value ? "OpenXnet 内置岗位中心" : "OpenXnet Built-in Role Studio"), 1),
                      n("h2", null, o(c.value ? "OpenXnet 内置职工角色模板库" : "OpenXnet Built-in Staff Role Library"), 1),
                      n("p", null, o(c.value ? "围绕平台工程、知识工程、测试质量、客户服务等方向扩展更多员工类型角色，便于企业空间快速组建协作团队，同时保持命名、文案和布局为 OpenXnet 自有表达。" : "Expand staff roles across platform, knowledge, quality, and service domains so enterprise spaces can assemble teams quickly with OpenXnet-native naming and presentation."), 1)
                    ]),
                    n("div", Ly, [
                      n("article", jy, [
                        n("span", null, o(vn.value.templateCount || qt.value.length), 1),
                        n("small", null, o(c.value ? "岗位模板" : "Templates"), 1)
                      ]),
                      n("article", By, [
                        n("span", null, o(vn.value.createdCount || gn.value.length), 1),
                        n("small", null, o(c.value ? "已创建员工" : "Created Roles"), 1)
                      ]),
                      n("article", Wy, [
                        n("span", null, o(vn.value.enabledCount || gn.value.filter((l) => l.enabled).length), 1),
                        n("small", null, o(c.value ? "启用中" : "Enabled"), 1)
                      ])
                    ])
                  ]),
                  n("section", Uy, [
                    n("div", Ky, [
                      r[115] || (r[115] = n("i", { class: "fa-solid fa-magnifying-glass" }, null, -1)),
                      Te(n("input", {
                        "onUpdate:modelValue": r[26] || (r[26] = (l) => ie.value = l),
                        type: "text",
                        placeholder: c.value ? "搜索岗位名称、部门、技能或职责" : "Search roles, departments, skills, or responsibilities"
                      }, null, 8, Hy), [
                        [je, ie.value]
                      ]),
                      ie.value ? (f(), v("button", {
                        key: 0,
                        type: "button",
                        class: "ox-vite-role-search__clear",
                        onClick: r[27] || (r[27] = (l) => ie.value = "")
                      }, [...r[114] || (r[114] = [
                        n("i", { class: "fa-solid fa-xmark" }, null, -1)
                      ])])) : q("", !0)
                    ]),
                    n("button", {
                      type: "button",
                      class: "ox-vite-ops-primary-btn",
                      onClick: qe
                    }, [
                      r[116] || (r[116] = n("i", { class: "fa-solid fa-user-plus" }, null, -1)),
                      n("span", null, o(c.value ? "新建自定义员工" : "Create Custom Role"), 1)
                    ])
                  ]),
                  n("section", qy, [
                    (f(!0), v(T, null, D(Hi.value, (l) => (f(), v("button", {
                      key: l.id,
                      type: "button",
                      class: $(["ox-vite-role-category-chip", { "is-active": st.value === l.id }]),
                      onClick: (P) => st.value = l.id
                    }, [
                      n("span", null, o(l.label), 1),
                      n("strong", null, o(zi(l.id)), 1)
                    ], 10, zy))), 128))
                  ]),
                  n("section", Yy, [
                    n("article", Gy, [
                      n("div", Qy, [
                        n("div", null, [
                          n("div", Xy, o(c.value ? "内置模板岗位库" : "Built-in Template Library"), 1),
                          n("h2", null, o(c.value ? "从模板快速创建职工角色卡" : "Quickly Create Staff Roles from Templates"), 1)
                        ]),
                        n("div", Jy, o(ms.value.length), 1)
                      ]),
                      ms.value.length ? (f(), v("div", Zy, [
                        (f(!0), v(T, null, D(ms.value, (l) => (f(), v("button", {
                          key: l.id,
                          type: "button",
                          class: "ox-vite-role-template-card",
                          style: rt(bs(l)),
                          onClick: (P) => Lt(l.id)
                        }, [
                          r[118] || (r[118] = n("div", { class: "ox-vite-role-template-card__glow" }, null, -1)),
                          n("div", tb, [
                            n("div", nb, [
                              n("i", {
                                class: $(l.icon)
                              }, null, 2)
                            ]),
                            n("span", sb, o(l.categoryLabel || (c.value ? "未分类" : "Uncategorized")), 1)
                          ]),
                          n("div", lb, o(l.name), 1),
                          n("div", ob, o(l.department), 1),
                          n("p", ib, o(l.summary), 1),
                          n("div", ab, [
                            (f(!0), v(T, null, D(l.skills || [], (P) => (f(), v("span", {
                              key: `${l.id}-${P}`,
                              class: "ox-vite-detail-chip"
                            }, o(P), 1))), 128))
                          ]),
                          n("div", rb, [
                            n("span", null, o(c.value ? "点击创建" : "Create from this role"), 1),
                            r[117] || (r[117] = n("i", { class: "fa-solid fa-arrow-up-right-from-square" }, null, -1))
                          ])
                        ], 12, eb))), 128))
                      ])) : (f(), v("div", cb, [
                        r[119] || (r[119] = n("i", { class: "fa-solid fa-folder-open" }, null, -1)),
                        n("strong", null, o(c.value ? "没有匹配的岗位模板" : "No matching staff role templates"), 1),
                        n("p", null, o(c.value ? "可以更换分类或清空搜索条件后继续查看。" : "Try a different category or clear the search to continue."), 1)
                      ]))
                    ]),
                    n("aside", ub, [
                      n("div", db, [
                        n("div", null, [
                          n("div", pb, o(c.value ? "推荐模板" : "Spotlight"), 1),
                          n("h2", null, o(c.value ? "优先启用的岗位组合" : "Recommended Role Mixes"), 1)
                        ])
                      ]),
                      n("div", fb, [
                        (f(!0), v(T, null, D(qi.value, (l) => (f(), v("button", {
                          key: `spotlight-${l.id}`,
                          type: "button",
                          class: "ox-vite-role-spotlight__card",
                          style: rt(bs(l)),
                          onClick: (P) => Lt(l.id)
                        }, [
                          n("div", gb, [
                            n("i", {
                              class: $(l.icon)
                            }, null, 2)
                          ]),
                          n("div", mb, [
                            n("div", _b, o(l.name), 1),
                            n("div", hb, o(l.department), 1),
                            n("p", null, o(l.summary), 1)
                          ])
                        ], 12, vb))), 128))
                      ]),
                      n("div", yb, [
                        r[120] || (r[120] = n("i", { class: "fa-solid fa-sparkles" }, null, -1)),
                        n("span", null, o(c.value ? "建议先创建 2-3 个基础岗位，再为每个工作空间补充专业岗位，能更快形成团队协作闭环。" : "Start with 2-3 core roles, then add specialist roles per workspace to form a stronger collaboration loop."), 1)
                      ])
                    ])
                  ]),
                  n("section", bb, [
                    n("div", xb, [
                      n("div", null, [
                        n("div", Sb, o(c.value ? "我的员工卡" : "My Staff Roles"), 1),
                        n("h2", null, o(c.value ? "已创建的企业职工角色卡" : "Created Enterprise Staff Roles"), 1)
                      ]),
                      n("div", kb, o(gn.value.length), 1)
                    ]),
                    gn.value.length ? (f(), v("div", wb, [
                      (f(!0), v(T, null, D(gn.value, (l) => (f(), v("article", {
                        key: l.id,
                        class: "ox-vite-role-library-card",
                        style: rt(bs(l))
                      }, [
                        n("div", Cb, [
                          n("span", {
                            class: $(["ox-vite-detail-chip", { "is-active": l.enabled }])
                          }, o(l.enabled ? c.value ? "启用中" : "Enabled" : c.value ? "已停用" : "Disabled"), 3),
                          n("button", {
                            type: "button",
                            class: "ox-vite-role-library-card__delete",
                            onClick: (P) => fn(l.id)
                          }, [...r[121] || (r[121] = [
                            n("i", { class: "fa-regular fa-trash-can" }, null, -1)
                          ])], 8, Mb)
                        ]),
                        n("div", Rb, [
                          n("div", Tb, [
                            n("i", {
                              class: $(l.icon)
                            }, null, 2)
                          ]),
                          n("div", Eb, [
                            n("div", Pb, o(l.name), 1),
                            n("div", Ab, [
                              l.department ? (f(), v("span", Db, o(l.department), 1)) : q("", !0),
                              l.workspace ? (f(), v("span", Ib, o(l.workspace), 1)) : q("", !0)
                            ])
                          ])
                        ]),
                        n("p", Vb, o(l.summary), 1),
                        n("div", Ob, [
                          (f(!0), v(T, null, D(l.skills || [], (P) => (f(), v("span", {
                            key: `${l.id}-${P}`,
                            class: "ox-vite-detail-chip"
                          }, o(P), 1))), 128))
                        ])
                      ], 4))), 128)),
                      n("button", {
                        type: "button",
                        class: "ox-vite-role-library-card ox-vite-role-library-card--add",
                        onClick: qe
                      }, [
                        r[122] || (r[122] = n("i", { class: "fa-solid fa-user-plus" }, null, -1)),
                        n("div", null, o(c.value ? "添加职工角色卡" : "Add Staff Role"), 1)
                      ])
                    ])) : (f(), v("div", $b, [
                      r[123] || (r[123] = n("i", { class: "fa-solid fa-user-group" }, null, -1)),
                      n("strong", null, o(c.value ? "还没有创建员工角色卡" : "No staff roles created yet"), 1),
                      n("p", null, o(c.value ? "先从模板岗位库中挑选一个岗位开始。" : "Start by choosing a template from the role library above."), 1)
                    ]))
                  ])
                ])) : h.value.activeTab === "enterprise-workspaces" ? (f(), v("section", Fb, [
                  n("section", Nb, [
                    n("div", Lb, [
                      n("div", jb, o(c.value ? "企业工作空间" : "Enterprise Workspaces"), 1),
                      n("h2", null, o(c.value ? "统一管理工作空间、角色绑定与项目边界" : "Manage workspaces, role bindings, and project boundaries in one lane"), 1),
                      n("p", null, o(c.value ? "先在这里统一创建和检查工作空间，再进入企业沙盘查看项目楼层、员工角色和 3D 结构，避免菜单有入口但缺少对应工作空间配置。" : "Create and review workspaces here first, then enter the enterprise sandbox for projects, staff roles, and the 3D structure."), 1)
                    ]),
                    n("div", Bb, [
                      n("button", {
                        type: "button",
                        class: "ox-vite-ops-primary-btn",
                        onClick: De
                      }, [
                        r[124] || (r[124] = n("i", { class: "fa-solid fa-plus" }, null, -1)),
                        n("span", null, o(c.value ? "创建工作空间" : "Create Workspace"), 1)
                      ])
                    ])
                  ]),
                  hl.value.items?.length ? (f(), v("section", Wb, [
                    (f(!0), v(T, null, D(hl.value.items || [], (l) => (f(), v("article", {
                      key: l.id,
                      class: "ox-vite-workspace-card"
                    }, [
                      n("div", Ub, [
                        n("div", Kb, [
                          r[125] || (r[125] = n("div", { class: "ox-vite-workspace-card__icon" }, [
                            n("i", { class: "fa-solid fa-building" })
                          ], -1)),
                          n("div", Hb, [
                            n("div", qb, o(l.name), 1),
                            n("div", zb, o(l.summary || l.path), 1)
                          ])
                        ]),
                        n("span", Yb, o(l.type), 1)
                      ]),
                      n("div", Gb, [
                        n("article", Qb, [
                          n("span", null, o(c.value ? "项目楼层" : "Projects"), 1),
                          n("strong", null, o(l.projectCount), 1)
                        ]),
                        n("article", Xb, [
                          n("span", null, o(c.value ? "指派角色" : "Roles"), 1),
                          n("strong", null, o(l.roleCount), 1)
                        ]),
                        n("article", Jb, [
                          n("span", null, o(c.value ? "权限" : "Permission"), 1),
                          n("strong", null, o(kl(l.permission)), 1)
                        ])
                      ]),
                      n("div", Zb, [
                        n("span", e1, o(l.summary || l.path), 1),
                        l.updatedAt ? (f(), v("span", t1, o(l.updatedAt), 1)) : q("", !0)
                      ]),
                      n("div", n1, [
                        n("button", {
                          type: "button",
                          class: "ox-vite-ops-primary-btn",
                          onClick: (P) => en(l.id)
                        }, [
                          r[126] || (r[126] = n("i", { class: "fa-solid fa-cube" }, null, -1)),
                          n("span", null, o(c.value ? "进入企业沙盘" : "Open Sandbox"), 1)
                        ], 8, s1),
                        n("button", {
                          type: "button",
                          class: "ox-vite-ops-secondary-btn",
                          onClick: (P) => Qe(l.id)
                        }, [
                          r[127] || (r[127] = n("i", { class: "fa-solid fa-pen" }, null, -1)),
                          n("span", null, o(c.value ? "复制配置" : "Duplicate Draft"), 1)
                        ], 8, l1),
                        n("button", {
                          type: "button",
                          class: "ox-vite-ops-secondary-btn",
                          onClick: (P) => jn(l.id)
                        }, [
                          r[128] || (r[128] = n("i", { class: "fa-regular fa-trash-can" }, null, -1)),
                          n("span", null, o(c.value ? "删除" : "Delete"), 1)
                        ], 8, o1)
                      ])
                    ]))), 128))
                  ])) : (f(), v("section", i1, [
                    r[130] || (r[130] = n("i", { class: "fa-solid fa-building" }, null, -1)),
                    n("strong", null, o(c.value ? "还没有工作空间" : "No workspaces yet"), 1),
                    n("p", null, o(c.value ? "创建第一个工作空间后，这里会展示项目边界、权限和角色绑定。" : "Create the first workspace and this panel will show project boundaries, permissions, and role bindings."), 1),
                    n("button", {
                      type: "button",
                      class: "ox-vite-ops-primary-btn",
                      onClick: De
                    }, [
                      r[129] || (r[129] = n("i", { class: "fa-solid fa-plus" }, null, -1)),
                      n("span", null, o(c.value ? "创建第一个工作空间" : "Create the first workspace"), 1)
                    ])
                  ]))
                ])) : h.value.activeTab === "enterprise-sandbox" ? (f(), v("section", a1, [
                  n("section", r1, [
                    n("div", c1, [
                      be.value.level > 0 ? (f(), v("button", {
                        key: 0,
                        type: "button",
                        class: "ox-vite-sandbox-back",
                        onClick: Si
                      }, [...r[131] || (r[131] = [
                        n("i", { class: "fa-solid fa-chevron-left" }, null, -1)
                      ])])) : q("", !0),
                      n("div", u1, [
                        n("div", d1, o(c.value ? "企业沙盘" : "Enterprise Sandbox"), 1),
                        n("h2", null, o(be.value.levelLabel || (c.value ? "企业园区" : "Enterprise Campus")), 1),
                        n("p", null, o(c.value ? "在这里按层级查看当前工作空间、项目楼层与员工编组，逐步逼近 3D 沙盘里的结构关系。" : "Inspect the current workspace, project floors, and staff roster by level, moving closer to the full 3D sandbox structure."), 1)
                      ])
                    ]),
                    n("div", p1, [
                      (f(!0), v(T, null, D(be.value.breadcrumb || [], (l, P) => (f(), v("button", {
                        key: `${l.id}-${P}`,
                        type: "button",
                        class: $(["ox-vite-sandbox-breadcrumb__chip", { "is-current": P === (be.value.breadcrumb || []).length - 1 }]),
                        onClick: (it) => P === (be.value.breadcrumb || []).length - 1 ? null : ki(l)
                      }, o(l.label), 11, f1))), 128))
                    ])
                  ]),
                  n("section", v1, [
                    n("article", g1, [
                      n("span", null, o(c.value ? "当前层级" : "Current Level"), 1),
                      n("strong", null, o(be.value.level), 1),
                      n("small", null, o(be.value.levelLabel), 1)
                    ]),
                    n("article", m1, [
                      n("span", null, o(c.value ? "当前工作空间" : "Current Workspace"), 1),
                      n("strong", null, o(be.value.currentWorkspace || "-"), 1)
                    ]),
                    n("article", _1, [
                      n("span", null, o(c.value ? "当前项目" : "Current Project"), 1),
                      n("strong", null, o(be.value.currentProject || "-"), 1)
                    ]),
                    n("article", h1, [
                      n("span", null, o(c.value ? "沙盘智能体" : "Sandbox Agents"), 1),
                      n("strong", null, o(be.value.roleCount || (be.value.items || []).length), 1)
                    ])
                  ]),
                  n("section", y1, [
                    n("article", b1, [
                      n("div", x1, [
                        n("div", null, [
                          n("div", S1, o(c.value ? "工作空间层" : "Workspace Layer"), 1),
                          n("h2", null, o(c.value ? "当前工作空间入口" : "Workspace Access Points"), 1)
                        ]),
                        n("button", {
                          type: "button",
                          class: "ox-vite-ops-primary-btn",
                          onClick: De
                        }, [
                          r[132] || (r[132] = n("i", { class: "fa-solid fa-plus" }, null, -1)),
                          n("span", null, o(c.value ? "创建工作空间" : "Create Workspace"), 1)
                        ])
                      ]),
                      n("div", k1, [
                        n("div", w1, [
                          (f(!0), v(T, null, D(be.value.workspaces || [], (l) => (f(), v("button", {
                            key: `sandbox-${l.id}`,
                            type: "button",
                            class: $(["ox-vite-workspace-card ox-vite-workspace-card--compact ox-vite-workspace-card--selectable", { "is-selected": Xe.value && Xe.value.id === l.id }]),
                            onClick: (P) => m.handleSandboxSelectWorkspace(l.id)
                          }, [
                            n("div", M1, [
                              n("div", R1, [
                                r[133] || (r[133] = n("div", { class: "ox-vite-workspace-card__icon" }, [
                                  n("i", { class: "fa-solid fa-building" })
                                ], -1)),
                                n("div", T1, [
                                  n("div", E1, o(l.name), 1),
                                  n("div", P1, o(l.type), 1)
                                ])
                              ])
                            ]),
                            n("div", A1, [
                              n("span", D1, o(l.projectCount) + " " + o(c.value ? "个项目" : "projects"), 1),
                              n("span", I1, o(l.roleCount) + " " + o(c.value ? "个角色" : "roles"), 1)
                            ]),
                            n("div", V1, [
                              n("button", {
                                type: "button",
                                class: "ox-vite-ops-primary-btn",
                                onClick: gc((P) => en(l.id), ["stop"])
                              }, [
                                r[134] || (r[134] = n("i", { class: "fa-solid fa-cube" }, null, -1)),
                                n("span", null, o(c.value ? "进入" : "Open"), 1)
                              ], 8, O1)
                            ])
                          ], 10, C1))), 128))
                        ]),
                        Xe.value ? (f(), v("aside", $1, [
                          n("div", F1, [
                            n("div", null, [
                              n("div", N1, o(c.value ? "工作空间详情" : "Workspace Detail"), 1),
                              n("h2", null, o(Xe.value.name), 1)
                            ])
                          ]),
                          n("div", L1, [
                            r[135] || (r[135] = n("div", { class: "ox-vite-workspace-card__icon ox-vite-project-card__icon--large" }, [
                              n("i", { class: "fa-solid fa-building" })
                            ], -1)),
                            n("div", null, [
                              n("div", j1, o(Xe.value.type), 1),
                              n("div", B1, o(Xe.value.summary || Xe.value.path), 1)
                            ])
                          ]),
                          n("div", W1, [
                            n("span", U1, o(Xe.value.projectCount) + " " + o(c.value ? "个项目" : "projects"), 1),
                            n("span", K1, o(Xe.value.roleCount) + " " + o(c.value ? "个角色" : "roles"), 1),
                            n("span", H1, o(kl(Xe.value.permission)), 1)
                          ]),
                          n("div", q1, [
                            n("button", {
                              type: "button",
                              class: "ox-vite-ops-primary-btn",
                              onClick: r[28] || (r[28] = (l) => en(Xe.value.id))
                            }, [
                              r[136] || (r[136] = n("i", { class: "fa-solid fa-cube" }, null, -1)),
                              n("span", null, o(c.value ? "进入工作空间层" : "Open Workspace Layer"), 1)
                            ]),
                            n("button", {
                              type: "button",
                              class: "ox-vite-ops-secondary-btn",
                              onClick: r[29] || (r[29] = (l) => Qe(Xe.value.id))
                            }, [
                              r[137] || (r[137] = n("i", { class: "fa-solid fa-pen" }, null, -1)),
                              n("span", null, o(c.value ? "编辑工作空间" : "Edit Workspace"), 1)
                            ]),
                            n("button", {
                              type: "button",
                              class: "ox-vite-ops-secondary-btn",
                              onClick: r[30] || (r[30] = (l) => dl(Xe.value.id))
                            }, [
                              r[138] || (r[138] = n("i", { class: "fa-solid fa-layer-group" }, null, -1)),
                              n("span", null, o(c.value ? "添加项目" : "Add Project"), 1)
                            ])
                          ])
                        ])) : q("", !0)
                      ])
                    ]),
                    n("article", z1, [
                      n("div", Y1, [
                        n("div", null, [
                          n("div", G1, o(c.value ? "项目楼层" : "Project Floors"), 1),
                          n("h2", null, o(c.value ? "当前上下文中的项目编组" : "Projects in the Current Context"), 1)
                        ]),
                        n("button", {
                          type: "button",
                          class: "ox-vite-ops-secondary-btn",
                          disabled: !be.value.currentWorkspaceId,
                          onClick: r[31] || (r[31] = (l) => dl(be.value.currentWorkspaceId))
                        }, [
                          r[139] || (r[139] = n("i", { class: "fa-solid fa-layer-group" }, null, -1)),
                          n("span", null, o(c.value ? "添加项目楼层" : "Add Project Floor"), 1)
                        ], 8, Q1)
                      ]),
                      be.value.projects?.length ? (f(), v("div", X1, [
                        n("div", J1, [
                          (f(!0), v(T, null, D(be.value.projects || [], (l) => (f(), v("button", {
                            key: l.id,
                            type: "button",
                            class: $(["ox-vite-project-card ox-vite-project-card--selectable", { "is-selected": ze.value && ze.value.id === l.id }]),
                            onClick: (P) => Ci(l.id)
                          }, [
                            n("div", ex, [
                              n("div", {
                                class: "ox-vite-project-card__icon",
                                style: rt({ background: l.color })
                              }, [
                                n("i", {
                                  class: $(l.icon)
                                }, null, 2)
                              ], 4),
                              n("div", null, [
                                n("div", tx, o(l.name), 1),
                                n("div", nx, o(l.workspace || (c.value ? "未绑定工作空间" : "No workspace")), 1)
                              ])
                            ]),
                            n("p", null, o(l.description || (c.value ? "当前项目楼层还没有补充描述。" : "No project description yet.")), 1),
                            n("div", sx, [
                              n("span", lx, o(c.value ? `第 ${l.floor} 层` : `Floor ${l.floor}`), 1)
                            ])
                          ], 10, Z1))), 128))
                        ]),
                        ze.value ? (f(), v("aside", ox, [
                          n("div", ix, [
                            n("div", null, [
                              n("div", ax, o(c.value ? "项目详情" : "Project Detail"), 1),
                              n("h2", null, o(ze.value.name), 1)
                            ])
                          ]),
                          n("div", rx, [
                            n("div", {
                              class: "ox-vite-project-card__icon ox-vite-project-card__icon--large",
                              style: rt({ background: ze.value.color })
                            }, [
                              n("i", {
                                class: $(ze.value.icon)
                              }, null, 2)
                            ], 4),
                            n("div", null, [
                              n("div", cx, o(ze.value.workspace || (c.value ? "未绑定工作空间" : "No workspace")), 1),
                              n("div", ux, o(c.value ? `第 ${ze.value.floor} 层` : `Floor ${ze.value.floor}`), 1)
                            ])
                          ]),
                          n("p", dx, o(ze.value.description || (c.value ? "当前项目楼层还没有补充描述。" : "No project description yet.")), 1),
                          n("div", px, [
                            n("button", {
                              type: "button",
                              class: "ox-vite-ops-primary-btn",
                              onClick: r[32] || (r[32] = (l) => wi(ze.value.id))
                            }, [
                              r[140] || (r[140] = n("i", { class: "fa-solid fa-cube" }, null, -1)),
                              n("span", null, o(c.value ? "进入项目楼层" : "Open Project Floor"), 1)
                            ]),
                            n("button", {
                              type: "button",
                              class: "ox-vite-ops-secondary-btn",
                              onClick: r[33] || (r[33] = (l) => bi(ze.value.id, ze.value.workspaceId))
                            }, [
                              r[141] || (r[141] = n("i", { class: "fa-solid fa-pen" }, null, -1)),
                              n("span", null, o(c.value ? "编辑项目" : "Edit Project"), 1)
                            ]),
                            n("button", {
                              type: "button",
                              class: "ox-vite-ops-secondary-btn",
                              onClick: r[34] || (r[34] = (l) => Ei())
                            }, [
                              r[142] || (r[142] = n("i", { class: "fa-solid fa-user-plus" }, null, -1)),
                              n("span", null, o(c.value ? "添加员工" : "Add Staff Role"), 1)
                            ]),
                            n("button", {
                              type: "button",
                              class: "ox-vite-ops-secondary-btn",
                              onClick: r[35] || (r[35] = (l) => xi(ze.value.id))
                            }, [
                              r[143] || (r[143] = n("i", { class: "fa-regular fa-trash-can" }, null, -1)),
                              n("span", null, o(c.value ? "删除项目" : "Delete Project"), 1)
                            ])
                          ])
                        ])) : q("", !0)
                      ])) : (f(), v("div", fx, [
                        r[144] || (r[144] = n("i", { class: "fa-solid fa-layer-group" }, null, -1)),
                        n("strong", null, o(c.value ? "当前还没有项目楼层" : "No project floors yet"), 1),
                        n("p", null, o(c.value ? "先进入一个工作空间，再为它添加项目楼层。" : "Enter a workspace first, then add project floors for it."), 1)
                      ]))
                    ])
                  ]),
                  n("section", vx, [
                    n("div", gx, [
                      n("div", null, [
                        n("div", mx, o(c.value ? "员工编组" : "Sandbox Roster"), 1),
                        n("h2", null, o(c.value ? "当前沙盘中的员工角色" : "Staff Roles Inside the Current Sandbox"), 1)
                      ]),
                      n("button", {
                        type: "button",
                        class: "ox-vite-ops-secondary-btn",
                        onClick: qe
                      }, [
                        r[145] || (r[145] = n("i", { class: "fa-solid fa-user-plus" }, null, -1)),
                        n("span", null, o(c.value ? "添加员工角色" : "Add Staff Role"), 1)
                      ])
                    ]),
                    be.value.items?.length ? (f(), v("div", _x, [
                      n("div", hx, [
                        (f(!0), v(T, null, D(be.value.items || [], (l) => (f(), v("button", {
                          key: l.id,
                          type: "button",
                          class: $(["ox-vite-role-library-card ox-vite-role-library-card--selectable", { "is-selected": Ie.value && Ie.value.id === l.id }]),
                          onClick: (P) => Mi(l.id)
                        }, [
                          n("div", bx, [
                            n("div", xx, [
                              n("i", {
                                class: $(l.icon)
                              }, null, 2)
                            ]),
                            n("div", Sx, [
                              n("div", kx, o(l.name), 1),
                              n("div", wx, [
                                n("span", null, o(l.department || l.role), 1),
                                l.workspace ? (f(), v("span", Cx, o(l.workspace), 1)) : q("", !0),
                                l.project ? (f(), v("span", Mx, o(l.project), 1)) : q("", !0)
                              ])
                            ])
                          ]),
                          n("div", Rx, [
                            n("span", Tx, o(wl(l.status)), 1),
                            (f(!0), v(T, null, D(l.skills || [], (P) => (f(), v("span", {
                              key: `${l.id}-${P}`,
                              class: "ox-vite-detail-chip"
                            }, o(P), 1))), 128))
                          ])
                        ], 10, yx))), 128))
                      ]),
                      Ie.value ? (f(), v("aside", Ex, [
                        n("div", Px, [
                          n("div", null, [
                            n("div", Ax, o(c.value ? "员工详情" : "Staff Detail"), 1),
                            n("h2", null, o(Ie.value.name), 1)
                          ])
                        ]),
                        n("div", Dx, [
                          n("div", Ix, [
                            n("i", {
                              class: $(Ie.value.icon)
                            }, null, 2)
                          ]),
                          n("div", null, [
                            n("div", Vx, o(Ie.value.department || Ie.value.role), 1),
                            n("div", Ox, [
                              et(o(Ie.value.workspace || "-") + " ", 1),
                              Ie.value.project ? (f(), v("span", $x, " · " + o(Ie.value.project), 1)) : q("", !0)
                            ])
                          ])
                        ]),
                        n("p", Fx, o(Ie.value.summary || (c.value ? "当前员工角色还没有补充摘要，后续可以继续细化职责、边界和提示词。" : "This staff role does not have a summary yet. Responsibilities, boundaries, and prompts can be refined next.")), 1),
                        n("div", Nx, [
                          n("span", Lx, o(wl(Ie.value.status)), 1),
                          (f(!0), v(T, null, D(Ie.value.skills || [], (l) => (f(), v("span", {
                            key: `${Ie.value.id}-detail-${l}`,
                            class: "ox-vite-detail-chip"
                          }, o(l), 1))), 128))
                        ]),
                        n("div", jx, [
                          n("button", {
                            type: "button",
                            class: "ox-vite-ops-secondary-btn",
                            onClick: r[36] || (r[36] = (l) => Ti(Ie.value.id))
                          }, [
                            r[146] || (r[146] = n("i", { class: "fa-solid fa-pen" }, null, -1)),
                            n("span", null, o(c.value ? "编辑角色" : "Edit Role"), 1)
                          ]),
                          n("button", {
                            type: "button",
                            class: "ox-vite-ops-primary-btn",
                            onClick: r[37] || (r[37] = (l) => Ri(Ie.value.id))
                          }, [
                            r[147] || (r[147] = n("i", { class: "fa-solid fa-comments" }, null, -1)),
                            n("span", null, o(c.value ? "发起对话" : "Open Chat"), 1)
                          ]),
                          n("button", {
                            type: "button",
                            class: "ox-vite-ops-secondary-btn",
                            onClick: r[38] || (r[38] = (l) => fn(Ie.value.id))
                          }, [
                            r[148] || (r[148] = n("i", { class: "fa-regular fa-trash-can" }, null, -1)),
                            n("span", null, o(c.value ? "删除角色" : "Delete Role"), 1)
                          ])
                        ])
                      ])) : q("", !0)
                    ])) : (f(), v("div", Bx, [
                      r[149] || (r[149] = n("i", { class: "fa-solid fa-user-group" }, null, -1)),
                      n("strong", null, o(c.value ? "还没有沙盘智能体" : "No sandbox agents yet"), 1),
                      n("p", null, o(c.value ? "当工作空间和角色绑定后，这里会开始显示沙盘编组。" : "Once workspaces and roles are bound, sandbox rosters will appear here."), 1)
                    ]))
                  ])
                ])) : (f(), v("section", Wx, [
                  (f(!0), v(T, null, D(h.value.xnetPanel?.items || [], (l) => (f(), v("article", {
                    key: l.id,
                    class: "ox-vite-media-card"
                  }, [
                    n("strong", null, o(l.title), 1),
                    n("small", null, o(l.status), 1),
                    n("div", Ux, [
                      n("span", Kx, o(l.autoConnect ? c.value ? "自动连接" : "Auto connect" : c.value ? "手动检查" : "Manual check"), 1)
                    ]),
                    n("small", null, o(l.url || (c.value ? "未配置服务地址" : "No configured URL")), 1),
                    n("small", null, o(l.lastCheck || (c.value ? "尚未检查" : "Not checked yet")), 1)
                  ]))), 128))
                ]))
              ], 64)) : t.surface === "storage" ? (f(), v(T, { key: 6 }, [
                n("section", Hx, [
                  (f(!0), v(T, null, D(h.value.overviewStats || [], (l) => (f(), v("span", {
                    key: l.id,
                    class: "ox-vite-detail-chip"
                  }, [
                    n("i", {
                      class: $(l.icon)
                    }, null, 2),
                    n("span", null, o(l.label) + " " + o(l.value), 1)
                  ]))), 128))
                ]),
                h.value.activeTab === "memory-v3" ? (f(), v("section", qx, [
                  n("div", zx, [
                    n("label", Yx, [
                      r[150] || (r[150] = n("i", { class: "fa-solid fa-user-gear" }, null, -1)),
                      Te(n("select", {
                        "onUpdate:modelValue": r[39] || (r[39] = (l) => Zt.value = l),
                        onChange: Bn
                      }, [
                        (f(!0), v(T, null, D(oe.value.agentOptions || [], (l) => (f(), v("option", {
                          key: l.id,
                          value: l.id
                        }, o(l.name), 9, Gx))), 128))
                      ], 544), [
                        [pc, Zt.value]
                      ])
                    ]),
                    n("label", Qx, [
                      r[151] || (r[151] = n("i", { class: "fa-solid fa-magnifying-glass" }, null, -1)),
                      Te(n("input", {
                        "onUpdate:modelValue": r[40] || (r[40] = (l) => ot.value = l),
                        type: "search",
                        placeholder: c.value ? "搜索标题、内容、任务或标签" : "Search title, content, task, or tags",
                        onKeyup: _c(Bn, ["enter"])
                      }, null, 40, Xx), [
                        [je, ot.value]
                      ])
                    ]),
                    n("label", Jx, [
                      Te(n("input", {
                        "onUpdate:modelValue": r[41] || (r[41] = (l) => _.value = l),
                        type: "checkbox",
                        onChange: Bn
                      }, null, 544), [
                        [no, _.value]
                      ]),
                      n("span", null, o(c.value ? "显示已退役" : "Show retired"), 1)
                    ]),
                    n("div", Zx, [
                      n("button", {
                        type: "button",
                        class: "ox-vite-icon-btn",
                        title: c.value ? "校验完整性" : "Verify integrity",
                        disabled: R.value,
                        onClick: Li
                      }, [...r[152] || (r[152] = [
                        n("i", { class: "fa-solid fa-shield-halved" }, null, -1)
                      ])], 8, eS),
                      n("button", {
                        type: "button",
                        class: "ox-vite-icon-btn",
                        title: c.value ? "导入记忆" : "Import memory",
                        disabled: R.value,
                        onClick: Bi
                      }, [...r[153] || (r[153] = [
                        n("i", { class: "fa-solid fa-file-import" }, null, -1)
                      ])], 8, tS),
                      n("button", {
                        type: "button",
                        class: "ox-vite-ops-primary-btn",
                        disabled: R.value,
                        onClick: fl
                      }, [
                        r[154] || (r[154] = n("i", { class: "fa-solid fa-plus" }, null, -1)),
                        n("span", null, o(c.value ? "新建记忆" : "New Memory"), 1)
                      ], 8, nS)
                    ])
                  ]),
                  M.value || oe.value.error ? (f(), v("div", sS, [
                    r[155] || (r[155] = n("i", { class: "fa-solid fa-circle-exclamation" }, null, -1)),
                    n("span", null, o(M.value || oe.value.error), 1)
                  ])) : oe.value.integrity ? (f(), v("div", {
                    key: 1,
                    class: $(["ox-vite-memory-notice", { "is-ok": oe.value.integrity.healthy }])
                  }, [
                    n("i", {
                      class: $(oe.value.integrity.healthy ? "fa-solid fa-circle-check" : "fa-solid fa-triangle-exclamation")
                    }, null, 2),
                    n("span", null, o(Ui(oe.value)), 1)
                  ], 2)) : q("", !0),
                  n("div", {
                    class: $(["ox-vite-memory-layout", { "is-loading": oe.value.loading || R.value }])
                  }, [
                    n("aside", lS, [
                      n("div", oS, [
                        n("div", null, [
                          n("span", null, o(c.value ? "记忆池" : "Memory Pool"), 1),
                          n("strong", null, o((oe.value.items || []).length), 1)
                        ]),
                        n("button", {
                          type: "button",
                          class: "ox-vite-icon-btn",
                          title: c.value ? "刷新" : "Refresh",
                          onClick: Bn
                        }, [...r[156] || (r[156] = [
                          n("i", { class: "fa-solid fa-rotate-right" }, null, -1)
                        ])], 8, iS)
                      ]),
                      (oe.value.items || []).length ? (f(), v("div", aS, [
                        (f(!0), v(T, null, D(oe.value.items || [], (l) => (f(), v("button", {
                          key: l.memoryId,
                          type: "button",
                          class: $(["ox-vite-memory-row", { active: oe.value.selectedMemoryId === l.memoryId }]),
                          onClick: (P) => $i(l.memoryId)
                        }, [
                          n("div", cS, [
                            n("strong", null, o(l.title), 1),
                            n("div", uS, [
                              n("span", {
                                class: "ox-vite-memory-type-badge",
                                "data-memory-type": l.memoryType
                              }, [
                                n("i", {
                                  class: $(_l(l.memoryType))
                                }, null, 2),
                                et(" " + o(ml(l.memoryType)), 1)
                              ], 8, dS),
                              n("span", null, "v" + o(l.version), 1)
                            ])
                          ]),
                          n("p", null, o(l.contentPreview || (c.value ? "暂无摘要" : "No preview")), 1),
                          n("div", pS, [
                            n("span", null, [
                              r[157] || (r[157] = n("i", { class: "fa-regular fa-user" }, null, -1)),
                              et(o(l.ownerAgent), 1)
                            ]),
                            n("span", {
                              class: $({ "is-retired": l.status === "RETIRED" })
                            }, o(l.status === "RETIRED" ? c.value ? "已退役" : "Retired" : c.value ? "生效中" : "Active"), 3)
                          ])
                        ], 10, rS))), 128))
                      ])) : (f(), v("div", fS, [
                        r[158] || (r[158] = n("i", { class: "fa-regular fa-folder-open" }, null, -1)),
                        n("span", null, o(c.value ? "当前 Agent 暂无可见记忆" : "No visible memory for this agent"), 1)
                      ]))
                    ]),
                    n("main", vS, [
                      y.value ? (f(), v(T, { key: 0 }, [
                        n("div", gS, [
                          n("div", null, [
                            n("span", null, o(k.value === "edit" ? c.value ? "编辑为新版本" : "Edit as New Version" : c.value ? "新建长期记忆" : "Create Long-term Memory"), 1),
                            n("strong", null, o(k.value === "edit" ? `v${C.value.baseVersion + 1}` : "V3"), 1)
                          ]),
                          n("button", {
                            type: "button",
                            class: "ox-vite-icon-btn",
                            title: c.value ? "关闭" : "Close",
                            onClick: r[42] || (r[42] = (l) => y.value = !1)
                          }, [...r[159] || (r[159] = [
                            n("i", { class: "fa-solid fa-xmark" }, null, -1)
                          ])], 8, mS)
                        ]),
                        n("div", _S, [
                          k.value === "create" ? (f(), v("label", hS, [
                            n("span", null, o(c.value ? "任务标识" : "Task ID"), 1),
                            Te(n("input", {
                              "onUpdate:modelValue": r[43] || (r[43] = (l) => C.value.taskId = l),
                              type: "text"
                            }, null, 512), [
                              [je, C.value.taskId]
                            ])
                          ])) : q("", !0),
                          n("label", yS, [
                            n("span", null, o(c.value ? "标题" : "Title"), 1),
                            Te(n("input", {
                              "onUpdate:modelValue": r[44] || (r[44] = (l) => C.value.title = l),
                              type: "text"
                            }, null, 512), [
                              [je, C.value.title]
                            ])
                          ]),
                          n("label", bS, [
                            n("span", null, o(c.value ? "记忆内容" : "Memory Content"), 1),
                            Te(n("textarea", {
                              "onUpdate:modelValue": r[45] || (r[45] = (l) => C.value.content = l),
                              rows: "10"
                            }, null, 512), [
                              [je, C.value.content]
                            ])
                          ]),
                          n("label", xS, [
                            n("span", null, o(c.value ? "共享 Agent" : "Shared Agents"), 1),
                            Te(n("input", {
                              "onUpdate:modelValue": r[46] || (r[46] = (l) => C.value.permissionsText = l),
                              type: "text",
                              placeholder: c.value ? "用逗号分隔，* 表示公开" : "Comma-separated; * means public"
                            }, null, 8, SS), [
                              [je, C.value.permissionsText]
                            ])
                          ]),
                          n("label", kS, [
                            n("span", null, o(c.value ? "标签" : "Tags"), 1),
                            Te(n("input", {
                              "onUpdate:modelValue": r[47] || (r[47] = (l) => C.value.tagsText = l),
                              type: "text",
                              placeholder: c.value ? "用逗号分隔" : "Comma-separated"
                            }, null, 8, wS), [
                              [je, C.value.tagsText]
                            ])
                          ]),
                          n("label", CS, [
                            n("span", null, o(c.value ? "质量评分" : "Quality Score") + " " + o(Number(C.value.qualityScore).toFixed(2)), 1),
                            Te(n("input", {
                              "onUpdate:modelValue": r[48] || (r[48] = (l) => C.value.qualityScore = l),
                              type: "range",
                              min: "0",
                              max: "1",
                              step: "0.05"
                            }, null, 512), [
                              [
                                je,
                                C.value.qualityScore,
                                void 0,
                                { number: !0 }
                              ]
                            ])
                          ]),
                          k.value === "edit" ? (f(), v("label", MS, [
                            n("span", null, o(c.value ? "修改原因" : "Change Reason"), 1),
                            Te(n("input", {
                              "onUpdate:modelValue": r[49] || (r[49] = (l) => C.value.reason = l),
                              type: "text"
                            }, null, 512), [
                              [je, C.value.reason]
                            ])
                          ])) : q("", !0)
                        ]),
                        n("div", RS, [
                          n("button", {
                            type: "button",
                            class: "ox-vite-ops-secondary-btn",
                            onClick: r[50] || (r[50] = (l) => y.value = !1)
                          }, [
                            n("span", null, o(c.value ? "取消" : "Cancel"), 1)
                          ]),
                          n("button", {
                            type: "button",
                            class: "ox-vite-ops-primary-btn",
                            disabled: R.value || !C.value.title || !C.value.content || k.value === "create" && !C.value.taskId,
                            onClick: Oi
                          }, [
                            r[160] || (r[160] = n("i", { class: "fa-solid fa-check" }, null, -1)),
                            n("span", null, o(c.value ? "提交版本" : "Commit Version"), 1)
                          ], 8, TS)
                        ])
                      ], 64)) : oe.value.selectedMemory ? (f(), v(T, { key: 1 }, [
                        n("div", ES, [
                          n("div", null, [
                            n("span", null, o(oe.value.selectedMemory.taskId), 1),
                            n("strong", null, "v" + o(oe.value.selectedMemory.version), 1)
                          ]),
                          n("div", PS, [
                            n("button", {
                              type: "button",
                              class: "ox-vite-icon-btn",
                              title: c.value ? "导出迁移包" : "Export transfer package",
                              onClick: ji
                            }, [...r[161] || (r[161] = [
                              n("i", { class: "fa-solid fa-file-export" }, null, -1)
                            ])], 8, AS),
                            gs.value ? (f(), v("button", {
                              key: 0,
                              type: "button",
                              class: "ox-vite-icon-btn",
                              title: c.value ? "编辑" : "Edit",
                              onClick: Vi
                            }, [...r[162] || (r[162] = [
                              n("i", { class: "fa-solid fa-pen" }, null, -1)
                            ])], 8, DS)) : q("", !0)
                          ])
                        ]),
                        n("div", IS, [
                          n("h2", null, o(oe.value.selectedMemory.title), 1),
                          n("div", VS, [
                            n("span", {
                              class: "ox-vite-memory-type-badge",
                              "data-memory-type": oe.value.selectedMemory.memoryType
                            }, [
                              n("i", {
                                class: $(_l(oe.value.selectedMemory.memoryType))
                              }, null, 2),
                              et(" " + o(ml(oe.value.selectedMemory.memoryType)), 1)
                            ], 8, OS),
                            (f(!0), v(T, null, D(Wi(oe.value.selectedMemory), (l) => (f(), v("span", {
                              key: l.key
                            }, o(l.label), 1))), 128))
                          ]),
                          n("p", null, o(oe.value.selectedMemory.content), 1)
                        ]),
                        n("dl", $S, [
                          n("div", null, [
                            n("dt", null, o(c.value ? "所有者" : "Owner"), 1),
                            n("dd", null, o(oe.value.selectedMemory.ownerAgent), 1)
                          ]),
                          n("div", null, [
                            n("dt", null, o(c.value ? "共享范围" : "Shared With"), 1),
                            n("dd", null, o((oe.value.selectedMemory.permissions || []).join(", ") || (c.value ? "仅所有者" : "Owner only")), 1)
                          ]),
                          n("div", null, [
                            n("dt", null, o(c.value ? "记录哈希" : "Record Hash"), 1),
                            n("dd", {
                              title: oe.value.selectedMemory.recordSha256
                            }, o(gl(oe.value.selectedMemory.recordSha256)), 9, FS)
                          ]),
                          n("div", null, [
                            n("dt", null, o(c.value ? "提交时间" : "Committed"), 1),
                            n("dd", null, o(vl(oe.value.selectedMemory.committedAtUtc)), 1)
                          ])
                        ]),
                        gs.value && oe.value.selectedMemory.status !== "RETIRED" ? (f(), v("div", NS, [
                          n("button", {
                            type: "button",
                            class: "ox-vite-ops-secondary-btn is-danger",
                            onClick: Ni
                          }, [
                            r[163] || (r[163] = n("i", { class: "fa-solid fa-box-archive" }, null, -1)),
                            n("span", null, o(c.value ? "退役记忆" : "Retire Memory"), 1)
                          ])
                        ])) : q("", !0)
                      ], 64)) : (f(), v("div", LS, [
                        r[164] || (r[164] = n("i", { class: "fa-solid fa-brain" }, null, -1)),
                        n("span", null, o(c.value ? "选择或新建一条记忆" : "Select or create a memory"), 1)
                      ]))
                    ]),
                    n("aside", jS, [
                      n("div", BS, [
                        n("div", null, [
                          n("span", null, o(c.value ? "版本时间线" : "Version Timeline"), 1),
                          n("strong", null, o((oe.value.history || []).length), 1)
                        ])
                      ]),
                      (oe.value.history || []).length ? (f(), v("div", WS, [
                        (f(!0), v(T, null, D(oe.value.history || [], (l) => (f(), v("article", {
                          key: l.recordSha256,
                          class: "ox-vite-memory-version"
                        }, [
                          r[166] || (r[166] = n("div", { class: "ox-vite-memory-version__rail" }, [
                            n("span")
                          ], -1)),
                          n("div", US, [
                            n("div", KS, [
                              n("strong", null, "v" + o(l.version), 1),
                              n("span", null, o(l.operation), 1)
                            ]),
                            n("p", null, o(vl(l.committedAtUtc)), 1),
                            n("small", {
                              title: l.recordSha256
                            }, o(gl(l.recordSha256)), 9, HS),
                            gs.value && l.version !== oe.value.selectedMemory?.version ? (f(), v("button", {
                              key: 0,
                              type: "button",
                              class: "ox-vite-memory-version__rollback",
                              onClick: (P) => Fi(l)
                            }, [
                              r[165] || (r[165] = n("i", { class: "fa-solid fa-clock-rotate-left" }, null, -1)),
                              n("span", null, o(c.value ? "回滚至此版本" : "Rollback to this version"), 1)
                            ], 8, qS)) : q("", !0)
                          ])
                        ]))), 128))
                      ])) : (f(), v("div", zS, [
                        n("span", null, o(c.value ? "暂无版本记录" : "No version history"), 1)
                      ]))
                    ])
                  ], 2)
                ])) : h.value.activeTab === "text" ? (f(), v("section", YS, [
                  n("div", GS, [
                    (f(!0), v(T, null, D(h.value.textFiles || [], (l) => (f(), v("article", {
                      key: l.id,
                      class: "ox-vite-list-row"
                    }, [
                      n("div", null, [
                        n("strong", null, o(l.name), 1),
                        n("p", null, o(l.ext) + " · " + o(l.size), 1)
                      ]),
                      n("span", null, o(l.time), 1)
                    ]))), 128))
                  ])
                ])) : h.value.activeTab === "image" ? (f(), v("section", QS, [
                  (f(!0), v(T, null, D(h.value.imageFiles || [], (l) => (f(), v("article", {
                    key: l.id,
                    class: "ox-vite-media-card"
                  }, [
                    r[167] || (r[167] = n("div", { class: "ox-vite-media-card__thumb" }, [
                      n("i", { class: "fa-regular fa-image" })
                    ], -1)),
                    n("strong", null, o(l.name), 1),
                    n("small", null, o(l.size), 1)
                  ]))), 128))
                ])) : h.value.activeTab === "video" ? (f(), v("section", XS, [
                  (f(!0), v(T, null, D(h.value.videoFiles || [], (l) => (f(), v("article", {
                    key: l.id,
                    class: "ox-vite-media-card"
                  }, [
                    r[168] || (r[168] = n("div", { class: "ox-vite-media-card__thumb" }, [
                      n("i", { class: "fa-solid fa-play" })
                    ], -1)),
                    n("strong", null, o(l.name), 1),
                    n("small", null, o(l.duration) + " · " + o(l.size), 1)
                  ]))), 128))
                ])) : (f(), v("section", JS, [
                  n("div", ZS, [
                    (f(!0), v(T, null, D(h.value.recallItems || [], (l) => (f(), v("article", {
                      key: l.id,
                      class: "ox-vite-list-row"
                    }, [
                      n("div", null, [
                        n("strong", null, o(l.title), 1),
                        n("p", null, o(l.note), 1)
                      ])
                    ]))), 128))
                  ])
                ]))
              ], 64)) : t.surface === "kernel" ? (f(), v(T, { key: 7 }, [
                n("div", ek, [
                  (f(!0), v(T, null, D(h.value.tabs || [], (l) => (f(), v("button", {
                    key: l.id,
                    type: "button",
                    class: $(["ox-vite-strip-tab", { active: h.value.activeTab === l.id }]),
                    onClick: (P) => p(l.id)
                  }, [
                    n("i", {
                      class: $(l.icon)
                    }, null, 2),
                    n("span", null, o(l.label), 1)
                  ], 10, tk))), 128))
                ]),
                n("section", nk, [
                  (f(!0), v(T, null, D(h.value.metrics || [], (l) => (f(), v("article", {
                    key: l.id,
                    class: "ox-vite-stat-card"
                  }, [
                    n("span", null, o(l.label), 1),
                    n("strong", null, o(l.value), 1),
                    n("small", null, o(l.note), 1)
                  ]))), 128))
                ]),
                n("section", sk, [
                  n("article", lk, [
                    n("div", ok, [
                      n("h2", null, o(c.value ? "运行画像" : "Runtime Profile"), 1),
                      n("p", null, o(h.value.updatedLabel), 1)
                    ]),
                    n("div", ik, [
                      (f(!0), v(T, null, D(h.value.runtimeRows || [], (l) => (f(), v("article", {
                        key: l.label,
                        class: "ox-vite-list-row"
                      }, [
                        n("div", null, [
                          n("strong", null, o(l.label), 1)
                        ]),
                        n("span", null, o(l.value), 1)
                      ]))), 128))
                    ])
                  ]),
                  n("article", ak, [
                    n("div", rk, [
                      n("h2", null, o(c.value ? "计划与动作" : "Plans & Actions"), 1),
                      n("p", null, o(c.value ? "优先显示近期内核行动与下一步建议。" : "Show recent kernel actions and recommended next steps first."), 1)
                    ]),
                    n("div", ck, [
                      (f(!0), v(T, null, D(h.value.actions || [], (l) => (f(), v("article", {
                        key: l.id,
                        class: "ox-vite-list-row"
                      }, [
                        n("div", null, [
                          n("strong", null, o(l.title), 1),
                          n("p", null, o(l.type), 1)
                        ]),
                        n("span", null, o(l.status) + o(l.next ? ` · ${l.next}` : ""), 1)
                      ]))), 128))
                    ])
                  ])
                ])
              ], 64)) : q("", !0)
            ])
          ], 2)
        ]))
      ], 64))
    ], 2));
  }
};
function qs() {
  document.querySelectorAll("[data-openxnet-ops-surface]").forEach((t) => {
    const s = t?.closest(".page");
    if (!t || t.dataset.viteMounted === "true" || s && window.getComputedStyle(s).display === "none")
      return;
    const i = String(t.dataset.openxnetOpsSurface || "").trim();
    bc(uk, { surface: i }).mount(t), t.dataset.viteMounted = "true";
  });
}
document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", qs, { once: !0 }) : qs();
window.addEventListener("openxnet-vite-ops-remount", qs);
