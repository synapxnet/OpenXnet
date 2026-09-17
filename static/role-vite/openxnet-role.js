// @__NO_SIDE_EFFECTS__
function Jn(e) {
  const t = /* @__PURE__ */ Object.create(null);
  for (const n of e.split(",")) t[n] = 1;
  return (n) => n in t;
}
const Q = {}, St = [], He = () => {
}, Js = () => !1, hn = (e) => e.charCodeAt(0) === 111 && e.charCodeAt(1) === 110 && // uppercase letter
(e.charCodeAt(2) > 122 || e.charCodeAt(2) < 97), gn = (e) => e.startsWith("onUpdate:"), pe = Object.assign, zn = (e, t) => {
  const n = e.indexOf(t);
  n > -1 && e.splice(n, 1);
}, oo = Object.prototype.hasOwnProperty, K = (e, t) => oo.call(e, t), V = Array.isArray, wt = (e) => Jt(e) === "[object Map]", zs = (e) => Jt(e) === "[object Set]", gs = (e) => Jt(e) === "[object Date]", $ = (e) => typeof e == "function", se = (e) => typeof e == "string", Be = (e) => typeof e == "symbol", Y = (e) => e !== null && typeof e == "object", Ys = (e) => (Y(e) || $(e)) && $(e.then) && $(e.catch), Xs = Object.prototype.toString, Jt = (e) => Xs.call(e), lo = (e) => Jt(e).slice(8, -1), Qs = (e) => Jt(e) === "[object Object]", Yn = (e) => se(e) && e !== "NaN" && e[0] !== "-" && "" + parseInt(e, 10) === e, Vt = /* @__PURE__ */ Jn(
  // the leading comma is intentional so empty string "" is also included
  ",key,ref,ref_for,ref_key,onVnodeBeforeMount,onVnodeMounted,onVnodeBeforeUpdate,onVnodeUpdated,onVnodeBeforeUnmount,onVnodeUnmounted"
), vn = (e) => {
  const t = /* @__PURE__ */ Object.create(null);
  return ((n) => t[n] || (t[n] = e(n)));
}, ro = /-\w/g, Pe = vn(
  (e) => e.replace(ro, (t) => t.slice(1).toUpperCase())
), ao = /\B([A-Z])/g, ht = vn(
  (e) => e.replace(ao, "-$1").toLowerCase()
), Zs = vn((e) => e.charAt(0).toUpperCase() + e.slice(1)), Cn = vn(
  (e) => e ? `on${Zs(e)}` : ""
), je = (e, t) => !Object.is(e, t), nn = (e, ...t) => {
  for (let n = 0; n < e.length; n++)
    e[n](...t);
}, ei = (e, t, n, s = !1) => {
  Object.defineProperty(e, t, {
    configurable: !0,
    enumerable: !1,
    writable: s,
    value: n
  });
}, Xn = (e) => {
  const t = parseFloat(e);
  return isNaN(t) ? e : t;
};
let vs;
const mn = () => vs || (vs = typeof globalThis < "u" ? globalThis : typeof self < "u" ? self : typeof window < "u" ? window : typeof globalThis < "u" ? globalThis : {});
function Mt(e) {
  if (V(e)) {
    const t = {};
    for (let n = 0; n < e.length; n++) {
      const s = e[n], i = se(s) ? po(s) : Mt(s);
      if (i)
        for (const o in i)
          t[o] = i[o];
    }
    return t;
  } else if (se(e) || Y(e))
    return e;
}
const co = /;(?![^(]*\))/g, uo = /:([^]+)/, fo = /\/\*[^]*?\*\//g;
function po(e) {
  const t = {};
  return e.replace(fo, "").split(co).forEach((n) => {
    if (n) {
      const s = n.split(uo);
      s.length > 1 && (t[s[0].trim()] = s[1].trim());
    }
  }), t;
}
function it(e) {
  let t = "";
  if (se(e))
    t = e;
  else if (V(e))
    for (let n = 0; n < e.length; n++) {
      const s = it(e[n]);
      s && (t += s + " ");
    }
  else if (Y(e))
    for (const n in e)
      e[n] && (t += n + " ");
  return t.trim();
}
const ho = "itemscope,allowfullscreen,formnovalidate,ismap,nomodule,novalidate,readonly", go = /* @__PURE__ */ Jn(ho);
function ti(e) {
  return !!e || e === "";
}
function vo(e, t) {
  if (e.length !== t.length) return !1;
  let n = !0;
  for (let s = 0; n && s < e.length; s++)
    n = Qn(e[s], t[s]);
  return n;
}
function Qn(e, t) {
  if (e === t) return !0;
  let n = gs(e), s = gs(t);
  if (n || s)
    return n && s ? e.getTime() === t.getTime() : !1;
  if (n = Be(e), s = Be(t), n || s)
    return e === t;
  if (n = V(e), s = V(t), n || s)
    return n && s ? vo(e, t) : !1;
  if (n = Y(e), s = Y(t), n || s) {
    if (!n || !s)
      return !1;
    const i = Object.keys(e).length, o = Object.keys(t).length;
    if (i !== o)
      return !1;
    for (const l in e) {
      const r = e.hasOwnProperty(l), u = t.hasOwnProperty(l);
      if (r && !u || !r && u || !Qn(e[l], t[l]))
        return !1;
    }
  }
  return String(e) === String(t);
}
const ni = (e) => !!(e && e.__v_isRef === !0), v = (e) => se(e) ? e : e == null ? "" : V(e) || Y(e) && (e.toString === Xs || !$(e.toString)) ? ni(e) ? v(e.value) : JSON.stringify(e, si, 2) : String(e), si = (e, t) => ni(t) ? si(e, t.value) : wt(t) ? {
  [`Map(${t.size})`]: [...t.entries()].reduce(
    (n, [s, i], o) => (n[Tn(s, o) + " =>"] = i, n),
    {}
  )
} : zs(t) ? {
  [`Set(${t.size})`]: [...t.values()].map((n) => Tn(n))
} : Be(t) ? Tn(t) : Y(t) && !V(t) && !Qs(t) ? String(t) : t, Tn = (e, t = "") => {
  var n;
  return (
    // Symbol.description in es2019+ so we need to cast here to pass
    // the lib: es2016 check
    Be(e) ? `Symbol(${(n = e.description) != null ? n : t})` : e
  );
};
let ue;
class mo {
  // TODO isolatedDeclarations "__v_skip"
  constructor(t = !1) {
    this.detached = t, this._active = !0, this._on = 0, this.effects = [], this.cleanups = [], this._isPaused = !1, this._warnOnRun = !0, this.__v_skip = !0, !t && ue && (ue.active ? (this.parent = ue, this.index = (ue.scopes || (ue.scopes = [])).push(
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
      const n = ue;
      try {
        return ue = this, t();
      } finally {
        ue = n;
      }
    }
  }
  /**
   * This should only be called on non-detached scopes
   * @internal
   */
  on() {
    ++this._on === 1 && (this.prevScope = ue, ue = this);
  }
  /**
   * This should only be called on non-detached scopes
   * @internal
   */
  off() {
    if (this._on > 0 && --this._on === 0) {
      if (ue === this)
        ue = this.prevScope;
      else {
        let t = ue;
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
function _o() {
  return ue;
}
let te;
const Rn = /* @__PURE__ */ new WeakSet();
class ii {
  constructor(t) {
    this.fn = t, this.deps = void 0, this.depsTail = void 0, this.flags = 5, this.next = void 0, this.cleanup = void 0, this.scheduler = void 0, ue && (ue.active ? ue.effects.push(this) : this.flags &= -2);
  }
  pause() {
    this.flags |= 64;
  }
  resume() {
    this.flags & 64 && (this.flags &= -65, Rn.has(this) && (Rn.delete(this), this.trigger()));
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
    this.flags |= 2, ms(this), ri(this);
    const t = te, n = Ie;
    te = this, Ie = !0;
    try {
      return this.fn();
    } finally {
      ai(this), te = t, Ie = n, this.flags &= -3;
    }
  }
  stop() {
    if (this.flags & 1) {
      for (let t = this.deps; t; t = t.nextDep)
        ts(t);
      this.deps = this.depsTail = void 0, ms(this), this.onStop && this.onStop(), this.flags &= -2;
    }
  }
  trigger() {
    this.flags & 64 ? Rn.add(this) : this.scheduler ? this.scheduler() : this.runIfDirty();
  }
  /**
   * @internal
   */
  runIfDirty() {
    Vn(this) && this.run();
  }
  get dirty() {
    return Vn(this);
  }
}
let oi = 0, Nt, Dt;
function li(e, t = !1) {
  if (e.flags |= 8, t) {
    e.next = Dt, Dt = e;
    return;
  }
  e.next = Nt, Nt = e;
}
function Zn() {
  oi++;
}
function es() {
  if (--oi > 0)
    return;
  if (Dt) {
    let t = Dt;
    for (Dt = void 0; t; ) {
      const n = t.next;
      t.next = void 0, t.flags &= -9, t = n;
    }
  }
  let e;
  for (; Nt; ) {
    let t = Nt;
    for (Nt = void 0; t; ) {
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
    s.version === -1 ? (s === n && (n = i), ts(s), yo(s)) : t = s, s.dep.activeLink = s.prevActiveLink, s.prevActiveLink = void 0, s = i;
  }
  e.deps = t, e.depsTail = n;
}
function Vn(e) {
  for (let t = e.deps; t; t = t.nextDep)
    if (t.dep.version !== t.version || t.dep.computed && (ci(t.dep.computed) || t.dep.version !== t.version))
      return !0;
  return !!e._dirty;
}
function ci(e) {
  if (e.flags & 4 && !(e.flags & 16) || (e.flags &= -17, e.globalVersion === Wt) || (e.globalVersion = Wt, !e.isSSR && e.flags & 128 && (!e.deps && !e._dirty || !Vn(e))))
    return;
  e.flags |= 2;
  const t = e.dep, n = te, s = Ie;
  te = e, Ie = !0;
  try {
    ri(e);
    const i = e.fn(e._value);
    (t.version === 0 || je(i, e._value)) && (e.flags |= 128, e._value = i, t.version++);
  } catch (i) {
    throw t.version++, i;
  } finally {
    te = n, Ie = s, ai(e), e.flags &= -3;
  }
}
function ts(e, t = !1) {
  const { dep: n, prevSub: s, nextSub: i } = e;
  if (s && (s.nextSub = i, e.prevSub = void 0), i && (i.prevSub = s, e.nextSub = void 0), n.subs === e && (n.subs = s, !s && n.computed)) {
    n.computed.flags &= -5;
    for (let o = n.computed.deps; o; o = o.nextDep)
      ts(o, !0);
  }
  !t && !--n.sc && n.map && n.map.delete(n.key);
}
function yo(e) {
  const { prevDep: t, nextDep: n } = e;
  t && (t.nextDep = n, e.prevDep = void 0), n && (n.prevDep = t, e.nextDep = void 0);
}
let Ie = !0;
const ui = [];
function Qe() {
  ui.push(Ie), Ie = !1;
}
function Ze() {
  const e = ui.pop();
  Ie = e === void 0 ? !0 : e;
}
function ms(e) {
  const { cleanup: t } = e;
  if (e.cleanup = void 0, t) {
    const n = te;
    te = void 0;
    try {
      t();
    } finally {
      te = n;
    }
  }
}
let Wt = 0;
class bo {
  constructor(t, n) {
    this.sub = t, this.dep = n, this.version = n.version, this.nextDep = this.prevDep = this.nextSub = this.prevSub = this.prevActiveLink = void 0;
  }
}
class ns {
  // TODO isolatedDeclarations "__v_skip"
  constructor(t) {
    this.computed = t, this.version = 0, this.activeLink = void 0, this.subs = void 0, this.map = void 0, this.key = void 0, this.sc = 0, this.__v_skip = !0;
  }
  track(t) {
    if (!te || !Ie || te === this.computed)
      return;
    let n = this.activeLink;
    if (n === void 0 || n.sub !== te)
      n = this.activeLink = new bo(te, this), te.deps ? (n.prevDep = te.depsTail, te.depsTail.nextDep = n, te.depsTail = n) : te.deps = te.depsTail = n, fi(n);
    else if (n.version === -1 && (n.version = this.version, n.nextDep)) {
      const s = n.nextDep;
      s.prevDep = n.prevDep, n.prevDep && (n.prevDep.nextDep = s), n.prevDep = te.depsTail, n.nextDep = void 0, te.depsTail.nextDep = n, te.depsTail = n, te.deps === n && (te.deps = s);
    }
    return n;
  }
  trigger(t) {
    this.version++, Wt++, this.notify(t);
  }
  notify(t) {
    Zn();
    try {
      for (let n = this.subs; n; n = n.prevSub)
        n.sub.notify() && n.sub.dep.notify();
    } finally {
      es();
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
const Nn = /* @__PURE__ */ new WeakMap(), dt = /* @__PURE__ */ Symbol(
  ""
), Dn = /* @__PURE__ */ Symbol(
  ""
), Ut = /* @__PURE__ */ Symbol(
  ""
);
function fe(e, t, n) {
  if (Ie && te) {
    let s = Nn.get(e);
    s || Nn.set(e, s = /* @__PURE__ */ new Map());
    let i = s.get(n);
    i || (s.set(n, i = new ns()), i.map = s, i.key = n), i.track();
  }
}
function ze(e, t, n, s, i, o) {
  const l = Nn.get(e);
  if (!l) {
    Wt++;
    return;
  }
  const r = (u) => {
    u && u.trigger();
  };
  if (Zn(), t === "clear")
    l.forEach(r);
  else {
    const u = V(e), p = u && Yn(n);
    if (u && n === "length") {
      const d = Number(s);
      l.forEach((g, R) => {
        (R === "length" || R === Ut || !Be(R) && R >= d) && r(g);
      });
    } else
      switch ((n !== void 0 || l.has(void 0)) && r(l.get(n)), p && r(l.get(Ut)), t) {
        case "add":
          u ? p && r(l.get("length")) : (r(l.get(dt)), wt(e) && r(l.get(Dn)));
          break;
        case "delete":
          u || (r(l.get(dt)), wt(e) && r(l.get(Dn)));
          break;
        case "set":
          wt(e) && r(l.get(dt));
          break;
      }
  }
  es();
}
function _t(e) {
  const t = /* @__PURE__ */ U(e);
  return t === e ? t : (fe(t, "iterate", Ut), /* @__PURE__ */ Se(e) ? t : t.map(Oe));
}
function _n(e) {
  return fe(e = /* @__PURE__ */ U(e), "iterate", Ut), e;
}
function De(e, t) {
  return /* @__PURE__ */ et(e) ? Rt(/* @__PURE__ */ pt(e) ? Oe(t) : t) : Oe(t);
}
const xo = {
  __proto__: null,
  [Symbol.iterator]() {
    return An(this, Symbol.iterator, (e) => De(this, e));
  },
  concat(...e) {
    return _t(this).concat(
      ...e.map((t) => V(t) ? _t(t) : t)
    );
  },
  entries() {
    return An(this, "entries", (e) => (e[1] = De(this, e[1]), e));
  },
  every(e, t) {
    return qe(this, "every", e, t, void 0, arguments);
  },
  filter(e, t) {
    return qe(
      this,
      "filter",
      e,
      t,
      (n) => n.map((s) => De(this, s)),
      arguments
    );
  },
  find(e, t) {
    return qe(
      this,
      "find",
      e,
      t,
      (n) => De(this, n),
      arguments
    );
  },
  findIndex(e, t) {
    return qe(this, "findIndex", e, t, void 0, arguments);
  },
  findLast(e, t) {
    return qe(
      this,
      "findLast",
      e,
      t,
      (n) => De(this, n),
      arguments
    );
  },
  findLastIndex(e, t) {
    return qe(this, "findLastIndex", e, t, void 0, arguments);
  },
  // flat, flatMap could benefit from ARRAY_ITERATE but are not straight-forward to implement
  forEach(e, t) {
    return qe(this, "forEach", e, t, void 0, arguments);
  },
  includes(...e) {
    return En(this, "includes", e);
  },
  indexOf(...e) {
    return En(this, "indexOf", e);
  },
  join(e) {
    return _t(this).join(e);
  },
  // keys() iterator only reads `length`, no optimization required
  lastIndexOf(...e) {
    return En(this, "lastIndexOf", e);
  },
  map(e, t) {
    return qe(this, "map", e, t, void 0, arguments);
  },
  pop() {
    return It(this, "pop");
  },
  push(...e) {
    return It(this, "push", e);
  },
  reduce(e, ...t) {
    return _s(this, "reduce", e, t);
  },
  reduceRight(e, ...t) {
    return _s(this, "reduceRight", e, t);
  },
  shift() {
    return It(this, "shift");
  },
  // slice could use ARRAY_ITERATE but also seems to beg for range tracking
  some(e, t) {
    return qe(this, "some", e, t, void 0, arguments);
  },
  splice(...e) {
    return It(this, "splice", e);
  },
  toReversed() {
    return _t(this).toReversed();
  },
  toSorted(e) {
    return _t(this).toSorted(e);
  },
  toSpliced(...e) {
    return _t(this).toSpliced(...e);
  },
  unshift(...e) {
    return It(this, "unshift", e);
  },
  values() {
    return An(this, "values", (e) => De(this, e));
  }
};
function An(e, t, n) {
  const s = _n(e), i = s[t]();
  return s !== e && !/* @__PURE__ */ Se(e) && (i._next = i.next, i.next = () => {
    const o = i._next();
    return o.done || (o.value = n(o.value)), o;
  }), i;
}
const So = Array.prototype;
function qe(e, t, n, s, i, o) {
  const l = _n(e), r = l !== e && !/* @__PURE__ */ Se(e), u = l[t];
  if (u !== So[t]) {
    const g = u.apply(e, o);
    return r ? Oe(g) : g;
  }
  let p = n;
  l !== e && (r ? p = function(g, R) {
    return n.call(this, De(e, g), R, e);
  } : n.length > 2 && (p = function(g, R) {
    return n.call(this, g, R, e);
  }));
  const d = u.call(l, p, s);
  return r && i ? i(d) : d;
}
function _s(e, t, n, s) {
  const i = _n(e), o = i !== e && !/* @__PURE__ */ Se(e);
  let l = n, r = !1;
  i !== e && (o ? (r = s.length === 0, l = function(p, d, g) {
    return r && (r = !1, p = De(e, p)), n.call(this, p, De(e, d), g, e);
  }) : n.length > 3 && (l = function(p, d, g) {
    return n.call(this, p, d, g, e);
  }));
  const u = i[t](l, ...s);
  return r ? De(e, u) : u;
}
function En(e, t, n) {
  const s = /* @__PURE__ */ U(e);
  fe(s, "iterate", Ut);
  const i = s[t](...n);
  return (i === -1 || i === !1) && /* @__PURE__ */ ls(n[0]) ? (n[0] = /* @__PURE__ */ U(n[0]), s[t](...n)) : i;
}
function It(e, t, n = []) {
  Qe(), Zn();
  const s = (/* @__PURE__ */ U(e))[t].apply(e, n);
  return es(), Ze(), s;
}
const wo = /* @__PURE__ */ Jn("__proto__,__v_isRef,__isVue"), di = new Set(
  /* @__PURE__ */ Object.getOwnPropertyNames(Symbol).filter((e) => e !== "arguments" && e !== "caller").map((e) => Symbol[e]).filter(Be)
);
function Mo(e) {
  Be(e) || (e = String(e));
  const t = /* @__PURE__ */ U(this);
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
      return s === (i ? o ? Fo : mi : o ? vi : gi).get(t) || // receiver is not the reactive proxy, but has the same prototype
      // this means the receiver is a user proxy of the reactive proxy
      Object.getPrototypeOf(t) === Object.getPrototypeOf(s) ? t : void 0;
    const l = V(t);
    if (!i) {
      let u;
      if (l && (u = xo[n]))
        return u;
      if (n === "hasOwnProperty")
        return Mo;
    }
    const r = Reflect.get(
      t,
      n,
      // if this is a proxy wrapping a ref, return methods using the raw ref
      // as receiver so that we don't have to call `toRaw` on the ref in all
      // its class methods
      /* @__PURE__ */ de(t) ? t : s
    );
    if ((Be(n) ? di.has(n) : wo(n)) || (i || fe(t, "get", n), o))
      return r;
    if (/* @__PURE__ */ de(r)) {
      const u = l && Yn(n) ? r : r.value;
      return i && Y(u) ? /* @__PURE__ */ jn(u) : u;
    }
    return Y(r) ? i ? /* @__PURE__ */ jn(r) : /* @__PURE__ */ is(r) : r;
  }
}
class hi extends pi {
  constructor(t = !1) {
    super(!1, t);
  }
  set(t, n, s, i) {
    let o = t[n];
    const l = V(t) && Yn(n);
    if (!this._isShallow) {
      const p = /* @__PURE__ */ et(o);
      if (!/* @__PURE__ */ Se(s) && !/* @__PURE__ */ et(s) && (o = /* @__PURE__ */ U(o), s = /* @__PURE__ */ U(s)), !l && /* @__PURE__ */ de(o) && !/* @__PURE__ */ de(s))
        return p || (o.value = s), !0;
    }
    const r = l ? Number(n) < t.length : K(t, n), u = Reflect.set(
      t,
      n,
      s,
      /* @__PURE__ */ de(t) ? t : i
    );
    return t === /* @__PURE__ */ U(i) && (r ? je(s, o) && ze(t, "set", n, s) : ze(t, "add", n, s)), u;
  }
  deleteProperty(t, n) {
    const s = K(t, n);
    t[n];
    const i = Reflect.deleteProperty(t, n);
    return i && s && ze(t, "delete", n, void 0), i;
  }
  has(t, n) {
    const s = Reflect.has(t, n);
    return (!Be(n) || !di.has(n)) && fe(t, "has", n), s;
  }
  ownKeys(t) {
    return fe(
      t,
      "iterate",
      V(t) ? "length" : dt
    ), Reflect.ownKeys(t);
  }
}
class Co extends pi {
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
const To = /* @__PURE__ */ new hi(), Ro = /* @__PURE__ */ new Co(), Ao = /* @__PURE__ */ new hi(!0);
const $n = (e) => e, Qt = (e) => Reflect.getPrototypeOf(e);
function Eo(e, t, n) {
  return function(...s) {
    const i = this.__v_raw, o = /* @__PURE__ */ U(i), l = wt(o), r = e === "entries" || e === Symbol.iterator && l, u = e === "keys" && l, p = i[e](...s), d = n ? $n : t ? Rt : Oe;
    return !t && fe(
      o,
      "iterate",
      u ? Dn : dt
    ), pe(
      // inheriting all iterator properties
      Object.create(p),
      {
        // iterator protocol
        next() {
          const { value: g, done: R } = p.next();
          return R ? { value: g, done: R } : {
            value: r ? [d(g[0]), d(g[1])] : d(g),
            done: R
          };
        }
      }
    );
  };
}
function Zt(e) {
  return function(...t) {
    return e === "delete" ? !1 : e === "clear" ? void 0 : this;
  };
}
function Po(e, t) {
  const n = {
    get(i) {
      const o = this.__v_raw, l = /* @__PURE__ */ U(o), r = /* @__PURE__ */ U(i);
      e || (je(i, r) && fe(l, "get", i), fe(l, "get", r));
      const { has: u } = Qt(l), p = t ? $n : e ? Rt : Oe;
      if (u.call(l, i))
        return p(o.get(i));
      if (u.call(l, r))
        return p(o.get(r));
      o !== l && o.get(i);
    },
    get size() {
      const i = this.__v_raw;
      return !e && fe(/* @__PURE__ */ U(i), "iterate", dt), i.size;
    },
    has(i) {
      const o = this.__v_raw, l = /* @__PURE__ */ U(o), r = /* @__PURE__ */ U(i);
      return e || (je(i, r) && fe(l, "has", i), fe(l, "has", r)), i === r ? o.has(i) : o.has(i) || o.has(r);
    },
    forEach(i, o) {
      const l = this, r = l.__v_raw, u = /* @__PURE__ */ U(r), p = t ? $n : e ? Rt : Oe;
      return !e && fe(u, "iterate", dt), r.forEach((d, g) => i.call(o, p(d), p(g), l));
    }
  };
  return pe(
    n,
    e ? {
      add: Zt("add"),
      set: Zt("set"),
      delete: Zt("delete"),
      clear: Zt("clear")
    } : {
      add(i) {
        const o = /* @__PURE__ */ U(this), l = Qt(o), r = /* @__PURE__ */ U(i), u = !t && !/* @__PURE__ */ Se(i) && !/* @__PURE__ */ et(i) ? r : i;
        return l.has.call(o, u) || je(i, u) && l.has.call(o, i) || je(r, u) && l.has.call(o, r) || (o.add(u), ze(o, "add", u, u)), this;
      },
      set(i, o) {
        !t && !/* @__PURE__ */ Se(o) && !/* @__PURE__ */ et(o) && (o = /* @__PURE__ */ U(o));
        const l = /* @__PURE__ */ U(this), { has: r, get: u } = Qt(l);
        let p = r.call(l, i);
        p || (i = /* @__PURE__ */ U(i), p = r.call(l, i));
        const d = u.call(l, i);
        return l.set(i, o), p ? je(o, d) && ze(l, "set", i, o) : ze(l, "add", i, o), this;
      },
      delete(i) {
        const o = /* @__PURE__ */ U(this), { has: l, get: r } = Qt(o);
        let u = l.call(o, i);
        u || (i = /* @__PURE__ */ U(i), u = l.call(o, i)), r && r.call(o, i);
        const p = o.delete(i);
        return u && ze(o, "delete", i, void 0), p;
      },
      clear() {
        const i = /* @__PURE__ */ U(this), o = i.size !== 0, l = i.clear();
        return o && ze(
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
    n[i] = Eo(i, e, t);
  }), n;
}
function ss(e, t) {
  const n = Po(e, t);
  return (s, i, o) => i === "__v_isReactive" ? !e : i === "__v_isReadonly" ? e : i === "__v_raw" ? s : Reflect.get(
    K(n, i) && i in s ? n : s,
    i,
    o
  );
}
const Io = {
  get: /* @__PURE__ */ ss(!1, !1)
}, Oo = {
  get: /* @__PURE__ */ ss(!1, !0)
}, ko = {
  get: /* @__PURE__ */ ss(!0, !1)
};
const gi = /* @__PURE__ */ new WeakMap(), vi = /* @__PURE__ */ new WeakMap(), mi = /* @__PURE__ */ new WeakMap(), Fo = /* @__PURE__ */ new WeakMap();
function Lo(e) {
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
function Vo(e) {
  return e.__v_skip || !Object.isExtensible(e) ? 0 : Lo(lo(e));
}
// @__NO_SIDE_EFFECTS__
function is(e) {
  return /* @__PURE__ */ et(e) ? e : os(
    e,
    !1,
    To,
    Io,
    gi
  );
}
// @__NO_SIDE_EFFECTS__
function No(e) {
  return os(
    e,
    !1,
    Ao,
    Oo,
    vi
  );
}
// @__NO_SIDE_EFFECTS__
function jn(e) {
  return os(
    e,
    !0,
    Ro,
    ko,
    mi
  );
}
function os(e, t, n, s, i) {
  if (!Y(e) || e.__v_raw && !(t && e.__v_isReactive))
    return e;
  const o = Vo(e);
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
function pt(e) {
  return /* @__PURE__ */ et(e) ? /* @__PURE__ */ pt(e.__v_raw) : !!(e && e.__v_isReactive);
}
// @__NO_SIDE_EFFECTS__
function et(e) {
  return !!(e && e.__v_isReadonly);
}
// @__NO_SIDE_EFFECTS__
function Se(e) {
  return !!(e && e.__v_isShallow);
}
// @__NO_SIDE_EFFECTS__
function ls(e) {
  return e ? !!e.__v_raw : !1;
}
// @__NO_SIDE_EFFECTS__
function U(e) {
  const t = e && e.__v_raw;
  return t ? /* @__PURE__ */ U(t) : e;
}
function Do(e) {
  return !K(e, "__v_skip") && Object.isExtensible(e) && ei(e, "__v_skip", !0), e;
}
const Oe = (e) => Y(e) ? /* @__PURE__ */ is(e) : e, Rt = (e) => Y(e) ? /* @__PURE__ */ jn(e) : e;
// @__NO_SIDE_EFFECTS__
function de(e) {
  return e ? e.__v_isRef === !0 : !1;
}
// @__NO_SIDE_EFFECTS__
function en(e) {
  return $o(e, !1);
}
function $o(e, t) {
  return /* @__PURE__ */ de(e) ? e : new jo(e, t);
}
class jo {
  constructor(t, n) {
    this.dep = new ns(), this.__v_isRef = !0, this.__v_isShallow = !1, this._rawValue = n ? t : /* @__PURE__ */ U(t), this._value = n ? t : Oe(t), this.__v_isShallow = n;
  }
  get value() {
    return this.dep.track(), this._value;
  }
  set value(t) {
    const n = this._rawValue, s = this.__v_isShallow || /* @__PURE__ */ Se(t) || /* @__PURE__ */ et(t);
    t = s ? t : /* @__PURE__ */ U(t), je(t, n) && (this._rawValue = t, this._value = s ? t : Oe(t), this.dep.trigger());
  }
}
function Ho(e) {
  return /* @__PURE__ */ de(e) ? e.value : e;
}
const Bo = {
  get: (e, t, n) => t === "__v_raw" ? e : Ho(Reflect.get(e, t, n)),
  set: (e, t, n, s) => {
    const i = e[t];
    return /* @__PURE__ */ de(i) && !/* @__PURE__ */ de(n) ? (i.value = n, !0) : Reflect.set(e, t, n, s);
  }
};
function _i(e) {
  return /* @__PURE__ */ pt(e) ? e : new Proxy(e, Bo);
}
class Wo {
  constructor(t, n, s) {
    this.fn = t, this.setter = n, this._value = void 0, this.dep = new ns(this), this.__v_isRef = !0, this.deps = void 0, this.depsTail = void 0, this.flags = 16, this.globalVersion = Wt - 1, this.next = void 0, this.effect = this, this.__v_isReadonly = !n, this.isSSR = s;
  }
  /**
   * @internal
   */
  notify() {
    if (this.flags |= 16, !(this.flags & 8) && // avoid infinite self recursion
    te !== this)
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
function Uo(e, t, n = !1) {
  let s, i;
  return $(e) ? s = e : (s = e.get, i = e.set), new Wo(s, i, n);
}
const tn = {}, rn = /* @__PURE__ */ new WeakMap();
let ft;
function Ko(e, t = !1, n = ft) {
  if (n) {
    let s = rn.get(n);
    s || rn.set(n, s = []), s.push(e);
  }
}
function qo(e, t, n = Q) {
  const { immediate: s, deep: i, once: o, scheduler: l, augmentJob: r, call: u } = n, p = (I) => i ? I : /* @__PURE__ */ Se(I) || i === !1 || i === 0 ? Ye(I, 1) : Ye(I);
  let d, g, R, E, j = !1, F = !1;
  if (/* @__PURE__ */ de(e) ? (g = () => e.value, j = /* @__PURE__ */ Se(e)) : /* @__PURE__ */ pt(e) ? (g = () => p(e), j = !0) : V(e) ? (F = !0, j = e.some((I) => /* @__PURE__ */ pt(I) || /* @__PURE__ */ Se(I)), g = () => e.map((I) => {
    if (/* @__PURE__ */ de(I))
      return I.value;
    if (/* @__PURE__ */ pt(I))
      return p(I);
    if ($(I))
      return u ? u(I, 2) : I();
  })) : $(e) ? t ? g = u ? () => u(e, 2) : e : g = () => {
    if (R) {
      Qe();
      try {
        R();
      } finally {
        Ze();
      }
    }
    const I = ft;
    ft = d;
    try {
      return u ? u(e, 3, [E]) : e(E);
    } finally {
      ft = I;
    }
  } : g = He, t && i) {
    const I = g, ie = i === !0 ? 1 / 0 : i;
    g = () => Ye(I(), ie);
  }
  const ne = _o(), Z = () => {
    d.stop(), ne && ne.active && zn(ne.effects, d);
  };
  if (o && t) {
    const I = t;
    t = (...ie) => {
      I(...ie), Z();
    };
  }
  let H = F ? new Array(e.length).fill(tn) : tn;
  const q = (I) => {
    if (!(!(d.flags & 1) || !d.dirty && !I))
      if (t) {
        const ie = d.run();
        if (i || j || (F ? ie.some((we, be) => je(we, H[be])) : je(ie, H))) {
          R && R();
          const we = ft;
          ft = d;
          try {
            const be = [
              ie,
              // pass undefined as the old value when it's changed for the first time
              H === tn ? void 0 : F && H[0] === tn ? [] : H,
              E
            ];
            H = ie, u ? u(t, 3, be) : (
              // @ts-expect-error
              t(...be)
            );
          } finally {
            ft = we;
          }
        }
      } else
        d.run();
  };
  return r && r(q), d = new ii(g), d.scheduler = l ? () => l(q, !1) : q, E = (I) => Ko(I, !1, d), R = d.onStop = () => {
    const I = rn.get(d);
    if (I) {
      if (u)
        u(I, 4);
      else
        for (const ie of I) ie();
      rn.delete(d);
    }
  }, t ? s ? q(!0) : H = d.run() : l ? l(q.bind(null, !0), !0) : d.run(), Z.pause = d.pause.bind(d), Z.resume = d.resume.bind(d), Z.stop = Z, Z;
}
function Ye(e, t = 1 / 0, n) {
  if (t <= 0 || !Y(e) || e.__v_skip || (n = n || /* @__PURE__ */ new Map(), (n.get(e) || 0) >= t))
    return e;
  if (n.set(e, t), t--, /* @__PURE__ */ de(e))
    Ye(e.value, t, n);
  else if (V(e))
    for (let s = 0; s < e.length; s++)
      Ye(e[s], t, n);
  else if (zs(e) || wt(e))
    e.forEach((s) => {
      Ye(s, t, n);
    });
  else if (Qs(e)) {
    for (const s in e)
      Ye(e[s], t, n);
    for (const s of Object.getOwnPropertySymbols(e))
      Object.prototype.propertyIsEnumerable.call(e, s) && Ye(e[s], t, n);
  }
  return e;
}
function zt(e, t, n, s) {
  try {
    return s ? e(...s) : e();
  } catch (i) {
    yn(i, t, n);
  }
}
function We(e, t, n, s) {
  if ($(e)) {
    const i = zt(e, t, n, s);
    return i && Ys(i) && i.catch((o) => {
      yn(o, t, n);
    }), i;
  }
  if (V(e)) {
    const i = [];
    for (let o = 0; o < e.length; o++)
      i.push(We(e[o], t, n, s));
    return i;
  }
}
function yn(e, t, n, s = !0) {
  const i = t ? t.vnode : null, { errorHandler: o, throwUnhandledErrorInProduction: l } = t && t.appContext.config || Q;
  if (t) {
    let r = t.parent;
    const u = t.proxy, p = `https://vuejs.org/error-reference/#runtime-${n}`;
    for (; r; ) {
      const d = r.ec;
      if (d) {
        for (let g = 0; g < d.length; g++)
          if (d[g](e, u, p) === !1)
            return;
      }
      r = r.parent;
    }
    if (o) {
      Qe(), zt(o, null, 10, [
        e,
        u,
        p
      ]), Ze();
      return;
    }
  }
  Go(e, n, i, s, l);
}
function Go(e, t, n, s = !0, i = !1) {
  if (i)
    throw e;
  console.error(e);
}
const ge = [];
let Ne = -1;
const Ct = [];
let st = null, bt = 0;
const yi = /* @__PURE__ */ Promise.resolve();
let an = null;
function bi(e) {
  const t = an || yi;
  return e ? t.then(this ? e.bind(this) : e) : t;
}
function Jo(e) {
  let t = Ne + 1, n = ge.length;
  for (; t < n; ) {
    const s = t + n >>> 1, i = ge[s], o = Kt(i);
    o < e || o === e && i.flags & 2 ? t = s + 1 : n = s;
  }
  return t;
}
function rs(e) {
  if (!(e.flags & 1)) {
    const t = Kt(e), n = ge[ge.length - 1];
    !n || // fast path when the job id is larger than the tail
    !(e.flags & 2) && t >= Kt(n) ? ge.push(e) : ge.splice(Jo(t), 0, e), e.flags |= 1, xi();
  }
}
function xi() {
  an || (an = yi.then(wi));
}
function zo(e) {
  V(e) ? Ct.push(...e) : st && e.id === -1 ? st.splice(bt + 1, 0, e) : e.flags & 1 || (Ct.push(e), e.flags |= 1), xi();
}
function ys(e, t, n = Ne + 1) {
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
  if (Ct.length) {
    const t = [...new Set(Ct)].sort(
      (n, s) => Kt(n) - Kt(s)
    );
    if (Ct.length = 0, st) {
      st.push(...t);
      return;
    }
    for (st = t, bt = 0; bt < st.length; bt++) {
      const n = st[bt];
      n.flags & 4 && (n.flags &= -2), n.flags & 8 || n(), n.flags &= -2;
    }
    st = null, bt = 0;
  }
}
const Kt = (e) => e.id == null ? e.flags & 2 ? -1 : 1 / 0 : e.id;
function wi(e) {
  try {
    for (Ne = 0; Ne < ge.length; Ne++) {
      const t = ge[Ne];
      t && !(t.flags & 8) && (t.flags & 4 && (t.flags &= -2), zt(
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
    Ne = -1, ge.length = 0, Si(), an = null, (ge.length || Ct.length) && wi();
  }
}
let xe = null, Mi = null;
function cn(e) {
  const t = xe;
  return xe = e, Mi = e && e.type.__scopeId || null, t;
}
function Yo(e, t = xe, n) {
  if (!t || e._n)
    return e;
  const s = (...i) => {
    s._d && Ps(-1);
    const o = cn(t);
    let l;
    try {
      l = e(...i);
    } finally {
      cn(o), s._d && Ps(1);
    }
    return l;
  };
  return s._n = !0, s._c = !0, s._d = !0, s;
}
function Xo(e, t) {
  if (xe === null)
    return e;
  const n = wn(xe), s = e.dirs || (e.dirs = []);
  for (let i = 0; i < t.length; i++) {
    let [o, l, r, u = Q] = t[i];
    o && ($(o) && (o = {
      mounted: o,
      updated: o
    }), o.deep && Ye(l), s.push({
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
function ct(e, t, n, s) {
  const i = e.dirs, o = t && t.dirs;
  for (let l = 0; l < i.length; l++) {
    const r = i[l];
    o && (r.oldValue = o[l].value);
    let u = r.dir[s];
    u && (Qe(), We(u, n, 8, [
      e.el,
      r,
      e,
      t
    ]), Ze());
  }
}
function Qo(e, t) {
  if (ve) {
    let n = ve.provides;
    const s = ve.parent && ve.parent.provides;
    s === n && (n = ve.provides = Object.create(s)), n[e] = t;
  }
}
function sn(e, t, n = !1) {
  const s = Yl();
  if (s || Tt) {
    let i = Tt ? Tt._context.provides : s ? s.parent == null || s.ce ? s.vnode.appContext && s.vnode.appContext.provides : s.parent.provides : void 0;
    if (i && e in i)
      return i[e];
    if (arguments.length > 1)
      return n && $(t) ? t.call(s && s.proxy) : t;
  }
}
const Zo = /* @__PURE__ */ Symbol.for("v-scx"), el = () => sn(Zo);
function on(e, t, n) {
  return Ci(e, t, n);
}
function Ci(e, t, n = Q) {
  const { immediate: s, deep: i, flush: o, once: l } = n, r = pe({}, n), u = t && s || !t && o !== "post";
  let p;
  if (Gt) {
    if (o === "sync") {
      const E = el();
      p = E.__watcherHandles || (E.__watcherHandles = []);
    } else if (!u) {
      const E = () => {
      };
      return E.stop = He, E.resume = He, E.pause = He, E;
    }
  }
  const d = ve;
  r.call = (E, j, F) => We(E, d, j, F);
  let g = !1;
  o === "post" ? r.scheduler = (E) => {
    me(E, d && d.suspense);
  } : o !== "sync" && (g = !0, r.scheduler = (E, j) => {
    j ? E() : rs(E);
  }), r.augmentJob = (E) => {
    t && (E.flags |= 4), g && (E.flags |= 2, d && (E.id = d.uid, E.i = d));
  };
  const R = qo(e, t, r);
  return Gt && (p ? p.push(R) : u && R()), R;
}
function tl(e, t, n) {
  const s = this.proxy, i = se(e) ? e.includes(".") ? Ti(s, e) : () => s[e] : e.bind(s, s);
  let o;
  $(t) ? o = t : (o = t.handler, n = t);
  const l = Yt(this), r = Ci(i, o.bind(s), n);
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
const nl = /* @__PURE__ */ Symbol("_vte"), sl = (e) => e.__isTeleport, il = /* @__PURE__ */ Symbol("_leaveCb");
function as(e, t) {
  e.shapeFlag & 6 && e.component ? (e.transition = t, as(e.component.subTree, t)) : e.shapeFlag & 128 ? (e.ssContent.transition = t.clone(e.ssContent), e.ssFallback.transition = t.clone(e.ssFallback)) : e.transition = t;
}
function Ri(e) {
  e.ids = [e.ids[0] + e.ids[2]++ + "-", 0, 0];
}
function bs(e, t) {
  let n;
  return !!((n = Object.getOwnPropertyDescriptor(e, t)) && !n.configurable);
}
const un = /* @__PURE__ */ new WeakMap();
function $t(e, t, n, s, i = !1) {
  if (V(e)) {
    e.forEach(
      (F, ne) => $t(
        F,
        t && (V(t) ? t[ne] : t),
        n,
        s,
        i
      )
    );
    return;
  }
  if (jt(s) && !i) {
    s.shapeFlag & 512 && s.type.__asyncResolved && s.component.subTree.component && $t(e, t, n, s.component.subTree);
    return;
  }
  const o = s.shapeFlag & 4 ? wn(s.component) : s.el, l = i ? null : o, { i: r, r: u } = e, p = t && t.r, d = r.refs === Q ? r.refs = {} : r.refs, g = r.setupState, R = /* @__PURE__ */ U(g), E = g === Q ? Js : (F) => bs(d, F) ? !1 : K(R, F), j = (F, ne) => !(ne && bs(d, ne));
  if (p != null && p !== u) {
    if (xs(t), se(p))
      d[p] = null, E(p) && (g[p] = null);
    else if (/* @__PURE__ */ de(p)) {
      const F = t;
      j(p, F.k) && (p.value = null), F.k && (d[F.k] = null);
    }
  }
  if ($(u))
    zt(u, r, 12, [l, d]);
  else {
    const F = se(u), ne = /* @__PURE__ */ de(u);
    if (F || ne) {
      const Z = () => {
        if (e.f) {
          const H = F ? E(u) ? g[u] : d[u] : j() || !e.k ? u.value : d[e.k];
          if (i)
            V(H) && zn(H, o);
          else if (V(H))
            H.includes(o) || H.push(o);
          else if (F)
            d[u] = [o], E(u) && (g[u] = d[u]);
          else {
            const q = [o];
            j(u, e.k) && (u.value = q), e.k && (d[e.k] = q);
          }
        } else F ? (d[u] = l, E(u) && (g[u] = l)) : ne && (j(u, e.k) && (u.value = l), e.k && (d[e.k] = l));
      };
      if (l) {
        const H = () => {
          Z(), un.delete(e);
        };
        H.id = -1, un.set(e, H), me(H, n);
      } else
        xs(e), Z();
    }
  }
}
function xs(e) {
  const t = un.get(e);
  t && (t.flags |= 8, un.delete(e));
}
mn().requestIdleCallback;
mn().cancelIdleCallback;
const jt = (e) => !!e.type.__asyncLoader, Ai = (e) => e.type.__isKeepAlive;
function ol(e, t) {
  Ei(e, "a", t);
}
function ll(e, t) {
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
  if (bn(t, s, n), n) {
    let i = n.parent;
    for (; i && i.parent; )
      Ai(i.parent.vnode) && rl(s, t, n, i), i = i.parent;
  }
}
function rl(e, t, n, s) {
  const i = bn(
    t,
    e,
    s,
    !0
    /* prepend */
  );
  Oi(() => {
    zn(s[t], i);
  }, n);
}
function bn(e, t, n = ve, s = !1) {
  if (n) {
    const i = n[e] || (n[e] = []), o = t.__weh || (t.__weh = (...l) => {
      Qe();
      const r = Yt(n), u = We(t, n, e, l);
      return r(), Ze(), u;
    });
    return s ? i.unshift(o) : i.push(o), o;
  }
}
const tt = (e) => (t, n = ve) => {
  (!Gt || e === "sp") && bn(e, (...s) => t(...s), n);
}, al = tt("bm"), Pi = tt("m"), cl = tt(
  "bu"
), ul = tt("u"), Ii = tt(
  "bum"
), Oi = tt("um"), fl = tt(
  "sp"
), dl = tt("rtg"), pl = tt("rtc");
function hl(e, t = ve) {
  bn("ec", e, t);
}
const gl = /* @__PURE__ */ Symbol.for("v-ndc");
function Ae(e, t, n, s) {
  let i;
  const o = n, l = V(e);
  if (l || se(e)) {
    const r = l && /* @__PURE__ */ pt(e);
    let u = !1, p = !1;
    r && (u = !/* @__PURE__ */ Se(e), p = /* @__PURE__ */ et(e), e = _n(e)), i = new Array(e.length);
    for (let d = 0, g = e.length; d < g; d++)
      i[d] = t(
        u ? p ? Rt(Oe(e[d])) : Oe(e[d]) : e[d],
        d,
        void 0,
        o
      );
  } else if (typeof e == "number") {
    i = new Array(e);
    for (let r = 0; r < e; r++)
      i[r] = t(r + 1, r, void 0, o);
  } else if (Y(e))
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
const Hn = (e) => e ? eo(e) ? wn(e) : Hn(e.parent) : null, Ht = (
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
    $parent: (e) => Hn(e.parent),
    $root: (e) => Hn(e.root),
    $host: (e) => e.ce,
    $emit: (e) => e.emit,
    $options: (e) => Fi(e),
    $forceUpdate: (e) => e.f || (e.f = () => {
      rs(e.update);
    }),
    $nextTick: (e) => e.n || (e.n = bi.bind(e.proxy)),
    $watch: (e) => tl.bind(e)
  })
), Pn = (e, t) => e !== Q && !e.__isScriptSetup && K(e, t), vl = {
  get({ _: e }, t) {
    if (t === "__v_skip")
      return !0;
    const { ctx: n, setupState: s, data: i, props: o, accessCache: l, type: r, appContext: u } = e;
    if (t[0] !== "$") {
      const R = l[t];
      if (R !== void 0)
        switch (R) {
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
        if (Pn(s, t))
          return l[t] = 1, s[t];
        if (i !== Q && K(i, t))
          return l[t] = 2, i[t];
        if (K(o, t))
          return l[t] = 3, o[t];
        if (n !== Q && K(n, t))
          return l[t] = 4, n[t];
        Bn && (l[t] = 0);
      }
    }
    const p = Ht[t];
    let d, g;
    if (p)
      return t === "$attrs" && fe(e.attrs, "get", ""), p(e);
    if (
      // css module (injected by vue-loader)
      (d = r.__cssModules) && (d = d[t])
    )
      return d;
    if (n !== Q && K(n, t))
      return l[t] = 4, n[t];
    if (
      // global properties
      g = u.config.globalProperties, K(g, t)
    )
      return g[t];
  },
  set({ _: e }, t, n) {
    const { data: s, setupState: i, ctx: o } = e;
    return Pn(i, t) ? (i[t] = n, !0) : s !== Q && K(s, t) ? (s[t] = n, !0) : K(e.props, t) || t[0] === "$" && t.slice(1) in e ? !1 : (o[t] = n, !0);
  },
  has({
    _: { data: e, setupState: t, accessCache: n, ctx: s, appContext: i, props: o, type: l }
  }, r) {
    let u;
    return !!(n[r] || e !== Q && r[0] !== "$" && K(e, r) || Pn(t, r) || K(o, r) || K(s, r) || K(Ht, r) || K(i.config.globalProperties, r) || (u = l.__cssModules) && u[r]);
  },
  defineProperty(e, t, n) {
    return n.get != null ? e._.accessCache[t] = 0 : K(n, "value") && this.set(e, t, n.value, null), Reflect.defineProperty(e, t, n);
  }
};
function Ss(e) {
  return V(e) ? e.reduce(
    (t, n) => (t[n] = null, t),
    {}
  ) : e;
}
let Bn = !0;
function ml(e) {
  const t = Fi(e), n = e.proxy, s = e.ctx;
  Bn = !1, t.beforeCreate && ws(t.beforeCreate, e, "bc");
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
    beforeMount: g,
    mounted: R,
    beforeUpdate: E,
    updated: j,
    activated: F,
    deactivated: ne,
    beforeDestroy: Z,
    beforeUnmount: H,
    destroyed: q,
    unmounted: I,
    render: ie,
    renderTracked: we,
    renderTriggered: be,
    errorCaptured: Me,
    serverPrefetch: gt,
    // public API
    expose: Ke,
    inheritAttrs: lt,
    // assets
    components: rt,
    directives: vt,
    filters: Et
  } = t;
  if (p && _l(p, s, null), l)
    for (const G in l) {
      const J = l[G];
      $(J) && (s[G] = J.bind(n));
    }
  if (i) {
    const G = i.call(n, n);
    Y(G) && (e.data = /* @__PURE__ */ is(G));
  }
  if (Bn = !0, o)
    for (const G in o) {
      const J = o[G], Ce = $(J) ? J.bind(n, n) : $(J.get) ? J.get.bind(n, n) : He, at = !$(J) && $(J.set) ? J.set.bind(n) : He, B = Ee({
        get: Ce,
        set: at
      });
      Object.defineProperty(s, G, {
        enumerable: !0,
        configurable: !0,
        get: () => B.value,
        set: (z) => B.value = z
      });
    }
  if (r)
    for (const G in r)
      ki(r[G], s, n, G);
  if (u) {
    const G = $(u) ? u.call(n) : u;
    Reflect.ownKeys(G).forEach((J) => {
      Qo(J, G[J]);
    });
  }
  d && ws(d, e, "c");
  function ae(G, J) {
    V(J) ? J.forEach((Ce) => G(Ce.bind(n))) : J && G(J.bind(n));
  }
  if (ae(al, g), ae(Pi, R), ae(cl, E), ae(ul, j), ae(ol, F), ae(ll, ne), ae(hl, Me), ae(pl, we), ae(dl, be), ae(Ii, H), ae(Oi, I), ae(fl, gt), V(Ke))
    if (Ke.length) {
      const G = e.exposed || (e.exposed = {});
      Ke.forEach((J) => {
        Object.defineProperty(G, J, {
          get: () => n[J],
          set: (Ce) => n[J] = Ce,
          enumerable: !0
        });
      });
    } else e.exposed || (e.exposed = {});
  ie && e.render === He && (e.render = ie), lt != null && (e.inheritAttrs = lt), rt && (e.components = rt), vt && (e.directives = vt), gt && Ri(e);
}
function _l(e, t, n = He) {
  V(e) && (e = Wn(e));
  for (const s in e) {
    const i = e[s];
    let o;
    Y(i) ? "default" in i ? o = sn(
      i.from || s,
      i.default,
      !0
    ) : o = sn(i.from || s) : o = sn(i), /* @__PURE__ */ de(o) ? Object.defineProperty(t, s, {
      enumerable: !0,
      configurable: !0,
      get: () => o.value,
      set: (l) => o.value = l
    }) : t[s] = o;
  }
}
function ws(e, t, n) {
  We(
    V(e) ? e.map((s) => s.bind(t.proxy)) : e.bind(t.proxy),
    t,
    n
  );
}
function ki(e, t, n, s) {
  let i = s.includes(".") ? Ti(n, s) : () => n[s];
  if (se(e)) {
    const o = t[e];
    $(o) && on(i, o);
  } else if ($(e))
    on(i, e.bind(n));
  else if (Y(e))
    if (V(e))
      e.forEach((o) => ki(o, t, n, s));
    else {
      const o = $(e.handler) ? e.handler.bind(n) : t[e.handler];
      $(o) && on(i, o, e);
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
    (p) => fn(u, p, l, !0)
  ), fn(u, t, l)), Y(t) && o.set(t, u), u;
}
function fn(e, t, n, s = !1) {
  const { mixins: i, extends: o } = t;
  o && fn(e, o, n, !0), i && i.forEach(
    (l) => fn(e, l, n, !0)
  );
  for (const l in t)
    if (!(s && l === "expose")) {
      const r = yl[l] || n && n[l];
      e[l] = r ? r(e[l], t[l]) : t[l];
    }
  return e;
}
const yl = {
  data: Ms,
  props: Cs,
  emits: Cs,
  // objects
  methods: Ft,
  computed: Ft,
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
  components: Ft,
  directives: Ft,
  // watch
  watch: xl,
  // provide / inject
  provide: Ms,
  inject: bl
};
function Ms(e, t) {
  return t ? e ? function() {
    return pe(
      $(e) ? e.call(this, this) : e,
      $(t) ? t.call(this, this) : t
    );
  } : t : e;
}
function bl(e, t) {
  return Ft(Wn(e), Wn(t));
}
function Wn(e) {
  if (V(e)) {
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
function Ft(e, t) {
  return e ? pe(/* @__PURE__ */ Object.create(null), e, t) : t;
}
function Cs(e, t) {
  return e ? V(e) && V(t) ? [.../* @__PURE__ */ new Set([...e, ...t])] : pe(
    /* @__PURE__ */ Object.create(null),
    Ss(e),
    Ss(t ?? {})
  ) : t;
}
function xl(e, t) {
  if (!e) return t;
  if (!t) return e;
  const n = pe(/* @__PURE__ */ Object.create(null), e);
  for (const s in t)
    n[s] = he(e[s], t[s]);
  return n;
}
function Li() {
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
let Sl = 0;
function wl(e, t) {
  return function(s, i = null) {
    $(s) || (s = pe({}, s)), i != null && !Y(i) && (i = null);
    const o = Li(), l = /* @__PURE__ */ new WeakSet(), r = [];
    let u = !1;
    const p = o.app = {
      _uid: Sl++,
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
      use(d, ...g) {
        return l.has(d) || (d && $(d.install) ? (l.add(d), d.install(p, ...g)) : $(d) && (l.add(d), d(p, ...g))), p;
      },
      mixin(d) {
        return o.mixins.includes(d) || o.mixins.push(d), p;
      },
      component(d, g) {
        return g ? (o.components[d] = g, p) : o.components[d];
      },
      directive(d, g) {
        return g ? (o.directives[d] = g, p) : o.directives[d];
      },
      mount(d, g, R) {
        if (!u) {
          const E = p._ceVNode || Xe(s, i);
          return E.appContext = o, R === !0 ? R = "svg" : R === !1 && (R = void 0), e(E, d, R), u = !0, p._container = d, d.__vue_app__ = p, wn(E.component);
        }
      },
      onUnmount(d) {
        r.push(d);
      },
      unmount() {
        u && (We(
          r,
          p._instance,
          16
        ), e(null, p._container), delete p._container.__vue_app__);
      },
      provide(d, g) {
        return o.provides[d] = g, p;
      },
      runWithContext(d) {
        const g = Tt;
        Tt = p;
        try {
          return d();
        } finally {
          Tt = g;
        }
      }
    };
    return p;
  };
}
let Tt = null;
const Ml = (e, t) => t === "modelValue" || t === "model-value" ? e.modelModifiers : e[`${t}Modifiers`] || e[`${Pe(t)}Modifiers`] || e[`${ht(t)}Modifiers`];
function Cl(e, t, ...n) {
  if (e.isUnmounted) return;
  const s = e.vnode.props || Q;
  let i = n;
  const o = t.startsWith("update:"), l = o && Ml(s, t.slice(7));
  l && (l.trim && (i = n.map((d) => se(d) ? d.trim() : d)), l.number && (i = n.map(Xn)));
  let r, u = s[r = Cn(t)] || // also try camelCase event handler (#2249)
  s[r = Cn(Pe(t))];
  !u && o && (u = s[r = Cn(ht(t))]), u && We(
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
    e.emitted[r] = !0, We(
      p,
      e,
      6,
      i
    );
  }
}
const Tl = /* @__PURE__ */ new WeakMap();
function Vi(e, t, n = !1) {
  const s = n ? Tl : t.emitsCache, i = s.get(e);
  if (i !== void 0)
    return i;
  const o = e.emits;
  let l = {}, r = !1;
  if (!$(e)) {
    const u = (p) => {
      const d = Vi(p, t, !0);
      d && (r = !0, pe(l, d));
    };
    !n && t.mixins.length && t.mixins.forEach(u), e.extends && u(e.extends), e.mixins && e.mixins.forEach(u);
  }
  return !o && !r ? (Y(e) && s.set(e, null), null) : (V(o) ? o.forEach((u) => l[u] = null) : pe(l, o), Y(e) && s.set(e, l), l);
}
function xn(e, t) {
  return !e || !hn(t) ? !1 : (t = t.slice(2).replace(/Once$/, ""), K(e, t[0].toLowerCase() + t.slice(1)) || K(e, ht(t)) || K(e, t));
}
function Ts(e) {
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
    props: g,
    data: R,
    setupState: E,
    ctx: j,
    inheritAttrs: F
  } = e, ne = cn(e);
  let Z, H;
  try {
    if (n.shapeFlag & 4) {
      const I = i || s, ie = I;
      Z = $e(
        p.call(
          ie,
          I,
          d,
          g,
          E,
          R,
          j
        )
      ), H = r;
    } else {
      const I = t;
      Z = $e(
        I.length > 1 ? I(
          g,
          { attrs: r, slots: l, emit: u }
        ) : I(
          g,
          null
        )
      ), H = t.props ? r : Rl(r);
    }
  } catch (I) {
    Bt.length = 0, yn(I, e, 1), Z = Xe(ot);
  }
  let q = Z;
  if (H && F !== !1) {
    const I = Object.keys(H), { shapeFlag: ie } = q;
    I.length && ie & 7 && (o && I.some(gn) && (H = Al(
      H,
      o
    )), q = At(q, H, !1, !0));
  }
  return n.dirs && (q = At(q, null, !1, !0), q.dirs = q.dirs ? q.dirs.concat(n.dirs) : n.dirs), n.transition && as(q, n.transition), Z = q, cn(ne), Z;
}
const Rl = (e) => {
  let t;
  for (const n in e)
    (n === "class" || n === "style" || hn(n)) && ((t || (t = {}))[n] = e[n]);
  return t;
}, Al = (e, t) => {
  const n = {};
  for (const s in e)
    (!gn(s) || !(s.slice(9) in t)) && (n[s] = e[s]);
  return n;
};
function El(e, t, n) {
  const { props: s, children: i, component: o } = e, { props: l, children: r, patchFlag: u } = t, p = o.emitsOptions;
  if (t.dirs || t.transition)
    return !0;
  if (n && u >= 0) {
    if (u & 1024)
      return !0;
    if (u & 16)
      return s ? Rs(s, l, p) : !!l;
    if (u & 8) {
      const d = t.dynamicProps;
      for (let g = 0; g < d.length; g++) {
        const R = d[g];
        if (Ni(l, s, R) && !xn(p, R))
          return !0;
      }
    }
  } else
    return (i || r) && (!r || !r.$stable) ? !0 : s === l ? !1 : s ? l ? Rs(s, l, p) : !0 : !!l;
  return !1;
}
function Rs(e, t, n) {
  const s = Object.keys(t);
  if (s.length !== Object.keys(e).length)
    return !0;
  for (let i = 0; i < s.length; i++) {
    const o = s[i];
    if (Ni(t, e, o) && !xn(n, o))
      return !0;
  }
  return !1;
}
function Ni(e, t, n) {
  const s = e[n], i = t[n];
  return n === "style" && Y(s) && Y(i) ? !Qn(s, i) : s !== i;
}
function Pl({ vnode: e, parent: t, suspense: n }, s) {
  for (; t; ) {
    const i = t.subTree;
    if (i.suspense && i.suspense.activeBranch === e && (i.suspense.vnode.el = i.el = s, e = i), i === e)
      (e = t.vnode).el = s, t = t.parent;
    else
      break;
  }
  n && n.activeBranch === e && (n.vnode.el = s);
}
const Di = {}, $i = () => Object.create(Di), ji = (e) => Object.getPrototypeOf(e) === Di;
function Il(e, t, n, s = !1) {
  const i = {}, o = $i();
  e.propsDefaults = /* @__PURE__ */ Object.create(null), Hi(e, t, i, o);
  for (const l in e.propsOptions[0])
    l in i || (i[l] = void 0);
  n ? e.props = s ? i : /* @__PURE__ */ No(i) : e.type.props ? e.props = i : e.props = o, e.attrs = o;
}
function Ol(e, t, n, s) {
  const {
    props: i,
    attrs: o,
    vnode: { patchFlag: l }
  } = e, r = /* @__PURE__ */ U(i), [u] = e.propsOptions;
  let p = !1;
  if (
    // always force full diff in dev
    // - #1942 if hmr is enabled with sfc component
    // - vite#872 non-sfc component used by sfc component
    (s || l > 0) && !(l & 16)
  ) {
    if (l & 8) {
      const d = e.vnode.dynamicProps;
      for (let g = 0; g < d.length; g++) {
        let R = d[g];
        if (xn(e.emitsOptions, R))
          continue;
        const E = t[R];
        if (u)
          if (K(o, R))
            E !== o[R] && (o[R] = E, p = !0);
          else {
            const j = Pe(R);
            i[j] = Un(
              u,
              r,
              j,
              E,
              e,
              !1
            );
          }
        else
          E !== o[R] && (o[R] = E, p = !0);
      }
    }
  } else {
    Hi(e, t, i, o) && (p = !0);
    let d;
    for (const g in r)
      (!t || // for camelCase
      !K(t, g) && // it's possible the original props was passed in as kebab-case
      // and converted to camelCase (#955)
      ((d = ht(g)) === g || !K(t, d))) && (u ? n && // for camelCase
      (n[g] !== void 0 || // for kebab-case
      n[d] !== void 0) && (i[g] = Un(
        u,
        r,
        g,
        void 0,
        e,
        !0
      )) : delete i[g]);
    if (o !== r)
      for (const g in o)
        (!t || !K(t, g)) && (delete o[g], p = !0);
  }
  p && ze(e.attrs, "set", "");
}
function Hi(e, t, n, s) {
  const [i, o] = e.propsOptions;
  let l = !1, r;
  if (t)
    for (let u in t) {
      if (Vt(u))
        continue;
      const p = t[u];
      let d;
      i && K(i, d = Pe(u)) ? !o || !o.includes(d) ? n[d] = p : (r || (r = {}))[d] = p : xn(e.emitsOptions, u) || (!(u in s) || p !== s[u]) && (s[u] = p, l = !0);
    }
  if (o) {
    const u = /* @__PURE__ */ U(n), p = r || Q;
    for (let d = 0; d < o.length; d++) {
      const g = o[d];
      n[g] = Un(
        i,
        u,
        g,
        p[g],
        e,
        !K(p, g)
      );
    }
  }
  return l;
}
function Un(e, t, n, s, i, o) {
  const l = e[n];
  if (l != null) {
    const r = K(l, "default");
    if (r && s === void 0) {
      const u = l.default;
      if (l.type !== Function && !l.skipFactory && $(u)) {
        const { propsDefaults: p } = i;
        if (n in p)
          s = p[n];
        else {
          const d = Yt(i);
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
    ] && (s === "" || s === ht(n)) && (s = !0));
  }
  return s;
}
const kl = /* @__PURE__ */ new WeakMap();
function Bi(e, t, n = !1) {
  const s = n ? kl : t.propsCache, i = s.get(e);
  if (i)
    return i;
  const o = e.props, l = {}, r = [];
  let u = !1;
  if (!$(e)) {
    const d = (g) => {
      u = !0;
      const [R, E] = Bi(g, t, !0);
      pe(l, R), E && r.push(...E);
    };
    !n && t.mixins.length && t.mixins.forEach(d), e.extends && d(e.extends), e.mixins && e.mixins.forEach(d);
  }
  if (!o && !u)
    return Y(e) && s.set(e, St), St;
  if (V(o))
    for (let d = 0; d < o.length; d++) {
      const g = Pe(o[d]);
      As(g) && (l[g] = Q);
    }
  else if (o)
    for (const d in o) {
      const g = Pe(d);
      if (As(g)) {
        const R = o[d], E = l[g] = V(R) || $(R) ? { type: R } : pe({}, R), j = E.type;
        let F = !1, ne = !0;
        if (V(j))
          for (let Z = 0; Z < j.length; ++Z) {
            const H = j[Z], q = $(H) && H.name;
            if (q === "Boolean") {
              F = !0;
              break;
            } else q === "String" && (ne = !1);
          }
        else
          F = $(j) && j.name === "Boolean";
        E[
          0
          /* shouldCast */
        ] = F, E[
          1
          /* shouldCastTrue */
        ] = ne, (F || K(E, "default")) && r.push(g);
      }
    }
  const p = [l, r];
  return Y(e) && s.set(e, p), p;
}
function As(e) {
  return e[0] !== "$" && !Vt(e);
}
const cs = (e) => e === "_" || e === "_ctx" || e === "$stable", us = (e) => V(e) ? e.map($e) : [$e(e)], Fl = (e, t, n) => {
  if (t._n)
    return t;
  const s = Yo((...i) => us(t(...i)), n);
  return s._c = !1, s;
}, Wi = (e, t, n) => {
  const s = e._ctx;
  for (const i in e) {
    if (cs(i)) continue;
    const o = e[i];
    if ($(o))
      t[i] = Fl(i, o, s);
    else if (o != null) {
      const l = us(o);
      t[i] = () => l;
    }
  }
}, Ui = (e, t) => {
  const n = us(t);
  e.slots.default = () => n;
}, Ki = (e, t, n) => {
  for (const s in t)
    (n || !cs(s)) && (e[s] = t[s]);
}, Ll = (e, t, n) => {
  const s = e.slots = $i();
  if (e.vnode.shapeFlag & 32) {
    const i = t._;
    i ? (Ki(s, t, n), n && ei(s, "_", i, !0)) : Wi(t, s);
  } else t && Ui(e, t);
}, Vl = (e, t, n) => {
  const { vnode: s, slots: i } = e;
  let o = !0, l = Q;
  if (s.shapeFlag & 32) {
    const r = t._;
    r ? n && r === 1 ? o = !1 : Ki(i, t, n) : (o = !t.$stable, Wi(t, i)), l = t;
  } else t && (Ui(e, t), l = { default: 1 });
  if (o)
    for (const r in i)
      !cs(r) && l[r] == null && delete i[r];
}, me = Hl;
function Nl(e) {
  return Dl(e);
}
function Dl(e, t) {
  const n = mn();
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
    parentNode: g,
    nextSibling: R,
    setScopeId: E = He,
    insertStaticContent: j
  } = e, F = (c, f, h, x = null, _ = null, y = null, T = void 0, C = null, M = !!f.dynamicChildren) => {
    if (c === f)
      return;
    c && !Ot(c, f) && (x = w(c), z(c, _, y, !0), c = null), f.patchFlag === -2 && (M = !1, f.dynamicChildren = null);
    const { type: b, ref: O, shapeFlag: A } = f;
    switch (b) {
      case Sn:
        ne(c, f, h, x);
        break;
      case ot:
        Z(c, f, h, x);
        break;
      case On:
        c == null && H(f, h, x, T);
        break;
      case le:
        rt(
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
        A & 1 ? ie(
          c,
          f,
          h,
          x,
          _,
          y,
          T,
          C,
          M
        ) : A & 6 ? vt(
          c,
          f,
          h,
          x,
          _,
          y,
          T,
          C,
          M
        ) : (A & 64 || A & 128) && b.process(
          c,
          f,
          h,
          x,
          _,
          y,
          T,
          C,
          M,
          mt
        );
    }
    O != null && _ ? $t(O, c && c.ref, y, f || c, !f) : O == null && c && c.ref != null && $t(c.ref, null, y, c, !0);
  }, ne = (c, f, h, x) => {
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
  }, Z = (c, f, h, x) => {
    c == null ? s(
      f.el = u(f.children || ""),
      h,
      x
    ) : f.el = c.el;
  }, H = (c, f, h, x) => {
    [c.el, c.anchor] = j(
      c.children,
      f,
      h,
      x,
      c.el,
      c.anchor
    );
  }, q = ({ el: c, anchor: f }, h, x) => {
    let _;
    for (; c && c !== f; )
      _ = R(c), s(c, h, x), c = _;
    s(f, h, x);
  }, I = ({ el: c, anchor: f }) => {
    let h;
    for (; c && c !== f; )
      h = R(c), i(c), c = h;
    i(f);
  }, ie = (c, f, h, x, _, y, T, C, M) => {
    if (f.type === "svg" ? T = "svg" : f.type === "math" && (T = "mathml"), c == null)
      we(
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
        b && b._beginPatch(), gt(
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
  }, we = (c, f, h, x, _, y, T, C) => {
    let M, b;
    const { props: O, shapeFlag: A, transition: P, dirs: L } = c;
    if (M = c.el = l(
      c.type,
      y,
      O && O.is,
      O
    ), A & 8 ? d(M, c.children) : A & 16 && Me(
      c.children,
      M,
      null,
      x,
      _,
      In(c, y),
      T,
      C
    ), L && ct(c, null, x, "created"), be(M, c, c.scopeId, T, x), O) {
      for (const X in O)
        X !== "value" && !Vt(X) && o(M, X, null, O[X], y, x);
      "value" in O && o(M, "value", null, O.value, y), (b = O.onVnodeBeforeMount) && Ve(b, x, c);
    }
    L && ct(c, null, x, "beforeMount");
    const W = $l(_, P);
    W && P.beforeEnter(M), s(M, f, h), ((b = O && O.onVnodeMounted) || W || L) && me(() => {
      b && Ve(b, x, c), W && P.enter(M), L && ct(c, null, x, "mounted");
    }, _);
  }, be = (c, f, h, x, _) => {
    if (h && E(c, h), x)
      for (let y = 0; y < x.length; y++)
        E(c, x[y]);
    if (_) {
      let y = _.subTree;
      if (f === y || zi(y.type) && (y.ssContent === f || y.ssFallback === f)) {
        const T = _.vnode;
        be(
          c,
          T,
          T.scopeId,
          T.slotScopeIds,
          _.parent
        );
      }
    }
  }, Me = (c, f, h, x, _, y, T, C, M = 0) => {
    for (let b = M; b < c.length; b++) {
      const O = c[b] = C ? Je(c[b]) : $e(c[b]);
      F(
        null,
        O,
        f,
        h,
        x,
        _,
        y,
        T,
        C
      );
    }
  }, gt = (c, f, h, x, _, y, T) => {
    const C = f.el = c.el;
    let { patchFlag: M, dynamicChildren: b, dirs: O } = f;
    M |= c.patchFlag & 16;
    const A = c.props || Q, P = f.props || Q;
    let L;
    if (h && ut(h, !1), (L = P.onVnodeBeforeUpdate) && Ve(L, h, f, c), O && ct(f, c, h, "beforeUpdate"), h && ut(h, !0), (A.innerHTML && P.innerHTML == null || A.textContent && P.textContent == null) && d(C, ""), b ? Ke(
      c.dynamicChildren,
      b,
      C,
      h,
      x,
      In(f, _),
      y
    ) : T || J(
      c,
      f,
      C,
      null,
      h,
      x,
      In(f, _),
      y,
      !1
    ), M > 0) {
      if (M & 16)
        lt(C, A, P, h, _);
      else if (M & 2 && A.class !== P.class && o(C, "class", null, P.class, _), M & 4 && o(C, "style", A.style, P.style, _), M & 8) {
        const W = f.dynamicProps;
        for (let X = 0; X < W.length; X++) {
          const ee = W[X], oe = A[ee], ce = P[ee];
          (ce !== oe || ee === "value") && o(C, ee, oe, ce, _, h);
        }
      }
      M & 1 && c.children !== f.children && d(C, f.children);
    } else !T && b == null && lt(C, A, P, h, _);
    ((L = P.onVnodeUpdated) || O) && me(() => {
      L && Ve(L, h, f, c), O && ct(f, c, h, "updated");
    }, x);
  }, Ke = (c, f, h, x, _, y, T) => {
    for (let C = 0; C < f.length; C++) {
      const M = c[C], b = f[C], O = (
        // oldVNode may be an errored async setup() component inside Suspense
        // which will not have a mounted element
        M.el && // - In the case of a Fragment, we need to provide the actual parent
        // of the Fragment itself so it can move its children.
        (M.type === le || // - In the case of different nodes, there is going to be a replacement
        // which also requires the correct parent container
        !Ot(M, b) || // - In the case of a component, it could contain anything.
        M.shapeFlag & 198) ? g(M.el) : (
          // In other cases, the parent container is not actually used so we
          // just pass the block element here to avoid a DOM parentNode call.
          h
        )
      );
      F(
        M,
        b,
        O,
        null,
        x,
        _,
        y,
        T,
        !0
      );
    }
  }, lt = (c, f, h, x, _) => {
    if (f !== h) {
      if (f !== Q)
        for (const y in f)
          !Vt(y) && !(y in h) && o(
            c,
            y,
            f[y],
            null,
            _,
            x
          );
      for (const y in h) {
        if (Vt(y)) continue;
        const T = h[y], C = f[y];
        T !== C && y !== "value" && o(c, y, C, T, _, x);
      }
      "value" in h && o(c, "value", f.value, h.value, _);
    }
  }, rt = (c, f, h, x, _, y, T, C, M) => {
    const b = f.el = c ? c.el : r(""), O = f.anchor = c ? c.anchor : r("");
    let { patchFlag: A, dynamicChildren: P, slotScopeIds: L } = f;
    L && (C = C ? C.concat(L) : L), c == null ? (s(b, h, x), s(O, h, x), Me(
      // #10007
      // such fragment like `<></>` will be compiled into
      // a fragment which doesn't have a children.
      // In this case fallback to an empty array
      f.children || [],
      h,
      O,
      _,
      y,
      T,
      C,
      M
    )) : A > 0 && A & 64 && P && // #2715 the previous fragment could've been a BAILed one as a result
    // of renderSlot() with no valid children
    c.dynamicChildren && c.dynamicChildren.length === P.length ? (Ke(
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
    )) : J(
      c,
      f,
      h,
      O,
      _,
      y,
      T,
      C,
      M
    );
  }, vt = (c, f, h, x, _, y, T, C, M) => {
    f.slotScopeIds = C, c == null ? f.shapeFlag & 512 ? _.ctx.activate(
      f,
      h,
      x,
      T,
      M
    ) : Et(
      f,
      h,
      x,
      _,
      y,
      T,
      M
    ) : S(c, f, M);
  }, Et = (c, f, h, x, _, y, T) => {
    const C = c.component = zl(
      c,
      x,
      _
    );
    if (Ai(c) && (C.ctx.renderer = mt), Xl(C, !1, T), C.asyncDep) {
      if (_ && _.registerDep(C, ae, T), !c.el) {
        const M = C.subTree = Xe(ot);
        Z(null, M, f, h), c.placeholder = M.el;
      }
    } else
      ae(
        C,
        c,
        f,
        h,
        _,
        y,
        T
      );
  }, S = (c, f, h) => {
    const x = f.component = c.component;
    if (El(c, f, h))
      if (x.asyncDep && !x.asyncResolved) {
        G(x, f, h);
        return;
      } else
        x.next = f, x.update();
    else
      f.el = c.el, x.vnode = f;
  }, ae = (c, f, h, x, _, y, T) => {
    const C = () => {
      if (c.isMounted) {
        let { next: A, bu: P, u: L, parent: W, vnode: X } = c;
        {
          const Fe = Gi(c);
          if (Fe) {
            A && (A.el = X.el, G(c, A, T)), Fe.asyncDep.then(() => {
              me(() => {
                c.isUnmounted || b();
              }, _);
            });
            return;
          }
        }
        let ee = A, oe;
        ut(c, !1), A ? (A.el = X.el, G(c, A, T)) : A = X, P && nn(P), (oe = A.props && A.props.onVnodeBeforeUpdate) && Ve(oe, W, A, X), ut(c, !0);
        const ce = Ts(c), ke = c.subTree;
        c.subTree = ce, F(
          ke,
          ce,
          // parent may have changed if it's in a teleport
          g(ke.el),
          // anchor may have changed if it's in a fragment
          w(ke),
          c,
          _,
          y
        ), A.el = ce.el, ee === null && Pl(c, ce.el), L && me(L, _), (oe = A.props && A.props.onVnodeUpdated) && me(
          () => Ve(oe, W, A, X),
          _
        );
      } else {
        let A;
        const { el: P, props: L } = f, { bm: W, m: X, parent: ee, root: oe, type: ce } = c, ke = jt(f);
        ut(c, !1), W && nn(W), !ke && (A = L && L.onVnodeBeforeMount) && Ve(A, ee, f), ut(c, !0);
        {
          oe.ce && oe.ce._hasShadowRoot() && oe.ce._injectChildStyle(
            ce,
            c.parent ? c.parent.type : void 0
          );
          const Fe = c.subTree = Ts(c);
          F(
            null,
            Fe,
            h,
            x,
            c,
            _,
            y
          ), f.el = Fe.el;
        }
        if (X && me(X, _), !ke && (A = L && L.onVnodeMounted)) {
          const Fe = f;
          me(
            () => Ve(A, ee, Fe),
            _
          );
        }
        (f.shapeFlag & 256 || ee && jt(ee.vnode) && ee.vnode.shapeFlag & 256) && c.a && me(c.a, _), c.isMounted = !0, f = h = x = null;
      }
    };
    c.scope.on();
    const M = c.effect = new ii(C);
    c.scope.off();
    const b = c.update = M.run.bind(M), O = c.job = M.runIfDirty.bind(M);
    O.i = c, O.id = c.uid, M.scheduler = () => rs(O), ut(c, !0), b();
  }, G = (c, f, h) => {
    f.component = c;
    const x = c.vnode.props;
    c.vnode = f, c.next = null, Ol(c, f.props, x, h), Vl(c, f.children, h), Qe(), ys(c), Ze();
  }, J = (c, f, h, x, _, y, T, C, M = !1) => {
    const b = c && c.children, O = c ? c.shapeFlag : 0, A = f.children, { patchFlag: P, shapeFlag: L } = f;
    if (P > 0) {
      if (P & 128) {
        at(
          b,
          A,
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
        Ce(
          b,
          A,
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
    L & 8 ? (O & 16 && k(b, _, y), A !== b && d(h, A)) : O & 16 ? L & 16 ? at(
      b,
      A,
      h,
      x,
      _,
      y,
      T,
      C,
      M
    ) : k(b, _, y, !0) : (O & 8 && d(h, ""), L & 16 && Me(
      A,
      h,
      x,
      _,
      y,
      T,
      C,
      M
    ));
  }, Ce = (c, f, h, x, _, y, T, C, M) => {
    c = c || St, f = f || St;
    const b = c.length, O = f.length, A = Math.min(b, O);
    let P;
    for (P = 0; P < A; P++) {
      const L = f[P] = M ? Je(f[P]) : $e(f[P]);
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
    b > O ? k(
      c,
      _,
      y,
      !0,
      !1,
      A
    ) : Me(
      f,
      h,
      x,
      _,
      y,
      T,
      C,
      M,
      A
    );
  }, at = (c, f, h, x, _, y, T, C, M) => {
    let b = 0;
    const O = f.length;
    let A = c.length - 1, P = O - 1;
    for (; b <= A && b <= P; ) {
      const L = c[b], W = f[b] = M ? Je(f[b]) : $e(f[b]);
      if (Ot(L, W))
        F(
          L,
          W,
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
    for (; b <= A && b <= P; ) {
      const L = c[A], W = f[P] = M ? Je(f[P]) : $e(f[P]);
      if (Ot(L, W))
        F(
          L,
          W,
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
      A--, P--;
    }
    if (b > A) {
      if (b <= P) {
        const L = P + 1, W = L < O ? f[L].el : x;
        for (; b <= P; )
          F(
            null,
            f[b] = M ? Je(f[b]) : $e(f[b]),
            h,
            W,
            _,
            y,
            T,
            C,
            M
          ), b++;
      }
    } else if (b > P)
      for (; b <= A; )
        z(c[b], _, y, !0), b++;
    else {
      const L = b, W = b, X = /* @__PURE__ */ new Map();
      for (b = W; b <= P; b++) {
        const _e = f[b] = M ? Je(f[b]) : $e(f[b]);
        _e.key != null && X.set(_e.key, b);
      }
      let ee, oe = 0;
      const ce = P - W + 1;
      let ke = !1, Fe = 0;
      const Pt = new Array(ce);
      for (b = 0; b < ce; b++) Pt[b] = 0;
      for (b = L; b <= A; b++) {
        const _e = c[b];
        if (oe >= ce) {
          z(_e, _, y, !0);
          continue;
        }
        let Le;
        if (_e.key != null)
          Le = X.get(_e.key);
        else
          for (ee = W; ee <= P; ee++)
            if (Pt[ee - W] === 0 && Ot(_e, f[ee])) {
              Le = ee;
              break;
            }
        Le === void 0 ? z(_e, _, y, !0) : (Pt[Le - W] = b + 1, Le >= Fe ? Fe = Le : ke = !0, F(
          _e,
          f[Le],
          h,
          null,
          _,
          y,
          T,
          C,
          M
        ), oe++);
      }
      const ds = ke ? jl(Pt) : St;
      for (ee = ds.length - 1, b = ce - 1; b >= 0; b--) {
        const _e = W + b, Le = f[_e], ps = f[_e + 1], hs = _e + 1 < O ? (
          // #13559, #14173 fallback to el placeholder for unresolved async component
          ps.el || Ji(ps)
        ) : x;
        Pt[b] === 0 ? F(
          null,
          Le,
          h,
          hs,
          _,
          y,
          T,
          C,
          M
        ) : ke && (ee < 0 || b !== ds[ee] ? B(Le, h, hs, 2) : ee--);
      }
    }
  }, B = (c, f, h, x, _ = null) => {
    const { el: y, type: T, transition: C, children: M, shapeFlag: b } = c;
    if (b & 6) {
      B(c.component.subTree, f, h, x);
      return;
    }
    if (b & 128) {
      c.suspense.move(f, h, x);
      return;
    }
    if (b & 64) {
      T.move(c, f, h, mt);
      return;
    }
    if (T === le) {
      s(y, f, h);
      for (let A = 0; A < M.length; A++)
        B(M[A], f, h, x);
      s(c.anchor, f, h);
      return;
    }
    if (T === On) {
      q(c, f, h);
      return;
    }
    if (x !== 2 && b & 1 && C)
      if (x === 0)
        C.beforeEnter(y), s(y, f, h), me(() => C.enter(y), _);
      else {
        const { leave: A, delayLeave: P, afterLeave: L } = C, W = () => {
          c.ctx.isUnmounted ? i(y) : s(y, f, h);
        }, X = () => {
          y._isLeaving && y[il](
            !0
            /* cancelled */
          ), A(y, () => {
            W(), L && L();
          });
        };
        P ? P(y, W, X) : X();
      }
    else
      s(y, f, h);
  }, z = (c, f, h, x = !1, _ = !1) => {
    const {
      type: y,
      props: T,
      ref: C,
      children: M,
      dynamicChildren: b,
      shapeFlag: O,
      patchFlag: A,
      dirs: P,
      cacheIndex: L,
      memo: W
    } = c;
    if (A === -2 && (_ = !1), C != null && (Qe(), $t(C, null, h, c, !0), Ze()), L != null && (f.renderCache[L] = void 0), O & 256) {
      f.ctx.deactivate(c);
      return;
    }
    const X = O & 1 && P, ee = !jt(c);
    let oe;
    if (ee && (oe = T && T.onVnodeBeforeUnmount) && Ve(oe, f, c), O & 6)
      Re(c.component, h, x);
    else {
      if (O & 128) {
        c.suspense.unmount(h, x);
        return;
      }
      X && ct(c, null, f, "beforeUnmount"), O & 64 ? c.type.remove(
        c,
        f,
        h,
        mt,
        x
      ) : b && // #5154
      // when v-once is used inside a block, setBlockTracking(-1) marks the
      // parent block with hasOnce: true
      // so that it doesn't take the fast path during unmount - otherwise
      // components nested in v-once are never unmounted.
      !b.hasOnce && // #1153: fast path should not be taken for non-stable (v-for) fragments
      (y !== le || A > 0 && A & 64) ? k(
        b,
        f,
        h,
        !1,
        !0
      ) : (y === le && A & 384 || !_ && O & 16) && k(M, f, h), x && Te(c);
    }
    const ce = W != null && L == null;
    (ee && (oe = T && T.onVnodeUnmounted) || X || ce) && me(() => {
      oe && Ve(oe, f, c), X && ct(c, null, f, "unmounted"), ce && (c.el = null);
    }, h);
  }, Te = (c) => {
    const { type: f, el: h, anchor: x, transition: _ } = c;
    if (f === le) {
      Xt(h, x);
      return;
    }
    if (f === On) {
      I(c);
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
  }, Xt = (c, f) => {
    let h;
    for (; c !== f; )
      h = R(c), i(c), c = h;
    i(f);
  }, Re = (c, f, h) => {
    const { bum: x, scope: _, job: y, subTree: T, um: C, m: M, a: b } = c;
    Es(M), Es(b), x && nn(x), _.stop(), y && (y.flags |= 8, z(T, c, f, h)), C && me(C, f), me(() => {
      c.isUnmounted = !0;
    }, f);
  }, k = (c, f, h, x = !1, _ = !1, y = 0) => {
    for (let T = y; T < c.length; T++)
      z(c[T], f, h, x, _);
  }, w = (c) => {
    if (c.shapeFlag & 6)
      return w(c.component.subTree);
    if (c.shapeFlag & 128)
      return c.suspense.next();
    const f = R(c.anchor || c.el), h = f && f[nl];
    return h ? R(h) : f;
  };
  let m = !1;
  const nt = (c, f, h) => {
    let x;
    c == null ? f._vnode && (z(f._vnode, null, null, !0), x = f._vnode.component) : F(
      f._vnode || null,
      c,
      f,
      null,
      null,
      null,
      h
    ), f._vnode = c, m || (m = !0, ys(x), Si(), m = !1);
  }, mt = {
    p: F,
    um: z,
    m: B,
    r: Te,
    mt: Et,
    mc: Me,
    pc: J,
    pbc: Ke,
    n: w,
    o: e
  };
  return {
    render: nt,
    hydrate: void 0,
    createApp: wl(nt)
  };
}
function In({ type: e, props: t }, n) {
  return n === "svg" && e === "foreignObject" || n === "mathml" && e === "annotation-xml" && t && t.encoding && t.encoding.includes("html") ? void 0 : n;
}
function ut({ effect: e, job: t }, n) {
  n ? (e.flags |= 32, t.flags |= 4) : (e.flags &= -33, t.flags &= -5);
}
function $l(e, t) {
  return (!e || e && !e.pendingBranch) && t && !t.persisted;
}
function qi(e, t, n = !1) {
  const s = e.children, i = t.children;
  if (V(s) && V(i))
    for (let o = 0; o < s.length; o++) {
      const l = s[o];
      let r = i[o];
      r.shapeFlag & 1 && !r.dynamicChildren && ((r.patchFlag <= 0 || r.patchFlag === 32) && (r = i[o] = Je(i[o]), r.el = l.el), !n && r.patchFlag !== -2 && qi(l, r)), r.type === Sn && (r.patchFlag === -1 && (r = i[o] = Je(r)), r.el = l.el), r.type === ot && !r.el && (r.el = l.el);
    }
}
function jl(e) {
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
function Es(e) {
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
function Hl(e, t) {
  t && t.pendingBranch ? V(e) ? t.effects.push(...e) : t.effects.push(e) : zo(e);
}
const le = /* @__PURE__ */ Symbol.for("v-fgt"), Sn = /* @__PURE__ */ Symbol.for("v-txt"), ot = /* @__PURE__ */ Symbol.for("v-cmt"), On = /* @__PURE__ */ Symbol.for("v-stc"), Bt = [];
let ye = null;
function N(e = !1) {
  Bt.push(ye = e ? null : []);
}
function Bl() {
  Bt.pop(), ye = Bt[Bt.length - 1] || null;
}
let qt = 1;
function Ps(e, t = !1) {
  qt += e, e < 0 && ye && t && (ye.hasOnce = !0);
}
function Yi(e) {
  return e.dynamicChildren = qt > 0 ? ye || St : null, Bl(), qt > 0 && ye && ye.push(e), e;
}
function D(e, t, n, s, i, o) {
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
function Wl(e, t, n, s, i) {
  return Yi(
    Xe(
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
function Ot(e, t) {
  return e.type === t.type && e.key === t.key;
}
const Qi = ({ key: e }) => e ?? null, ln = ({
  ref: e,
  ref_key: t,
  ref_for: n
}) => (typeof e == "number" && (e = "" + e), e != null ? se(e) || /* @__PURE__ */ de(e) || $(e) ? { i: xe, r: e, k: t, f: !!n } : e : null);
function a(e, t = null, n = null, s = 0, i = null, o = e === le ? 0 : 1, l = !1, r = !1) {
  const u = {
    __v_isVNode: !0,
    __v_skip: !0,
    type: e,
    props: t,
    key: t && Qi(t),
    ref: t && ln(t),
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
    ctx: xe
  };
  return r ? (fs(u, n), o & 128 && e.normalize(u)) : n && (u.shapeFlag |= se(n) ? 8 : 16), qt > 0 && // avoid a block node from tracking itself
  !l && // has current parent block
  ye && // presence of a patch flag indicates this node needs patching on updates.
  // component nodes also should always be patched, because even if the
  // component doesn't need to update, it needs to persist the instance on to
  // the next vnode so that it can be properly unmounted later.
  (u.patchFlag > 0 || o & 6) && // the EVENTS flag is only for hydration and if it is the only flag, the
  // vnode should not be considered dynamic due to handler caching.
  u.patchFlag !== 32 && ye.push(u), u;
}
const Xe = Ul;
function Ul(e, t = null, n = null, s = 0, i = null, o = !1) {
  if ((!e || e === gl) && (e = ot), Xi(e)) {
    const r = At(
      e,
      t,
      !0
      /* mergeRef: true */
    );
    return n && fs(r, n), qt > 0 && !o && ye && (r.shapeFlag & 6 ? ye[ye.indexOf(e)] = r : ye.push(r)), r.patchFlag = -2, r;
  }
  if (tr(e) && (e = e.__vccOpts), t) {
    t = Kl(t);
    let { class: r, style: u } = t;
    r && !se(r) && (t.class = it(r)), Y(u) && (/* @__PURE__ */ ls(u) && !V(u) && (u = pe({}, u)), t.style = Mt(u));
  }
  const l = se(e) ? 1 : zi(e) ? 128 : sl(e) ? 64 : Y(e) ? 4 : $(e) ? 2 : 0;
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
function Kl(e) {
  return e ? /* @__PURE__ */ ls(e) || ji(e) ? pe({}, e) : e : null;
}
function At(e, t, n = !1, s = !1) {
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
      n && o ? V(o) ? o.concat(ln(t)) : [o, ln(t)] : ln(t)
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
    patchFlag: t && e.type !== le ? l === -1 ? 16 : l | 16 : l,
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
    ssContent: e.ssContent && At(e.ssContent),
    ssFallback: e.ssFallback && At(e.ssFallback),
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
function Zi(e = " ", t = 0) {
  return Xe(Sn, null, e, t);
}
function yt(e = "", t = !1) {
  return t ? (N(), Wl(ot, null, e)) : Xe(ot, null, e);
}
function $e(e) {
  return e == null || typeof e == "boolean" ? Xe(ot) : V(e) ? Xe(
    le,
    null,
    // #3666, avoid reference pollution when reusing vnode
    e.slice()
  ) : Xi(e) ? Je(e) : Xe(Sn, null, String(e));
}
function Je(e) {
  return e.el === null && e.patchFlag !== -1 || e.memo ? e : At(e);
}
function fs(e, t) {
  let n = 0;
  const { shapeFlag: s } = e;
  if (t == null)
    t = null;
  else if (V(t))
    n = 16;
  else if (typeof t == "object")
    if (s & 65) {
      const i = t.default;
      i && (i._c && (i._d = !1), fs(e, i()), i._c && (i._d = !0));
      return;
    } else {
      n = 32;
      const i = t._;
      !i && !ji(t) ? t._ctx = xe : i === 3 && xe && (xe.slots._ === 1 ? t._ = 1 : (t._ = 2, e.patchFlag |= 1024));
    }
  else $(t) ? (t = { default: t, _ctx: xe }, n = 32) : (t = String(t), s & 64 ? (n = 16, t = [Zi(t)]) : n = 8);
  e.children = t, e.shapeFlag |= n;
}
function ql(...e) {
  const t = {};
  for (let n = 0; n < e.length; n++) {
    const s = e[n];
    for (const i in s)
      if (i === "class")
        t.class !== s.class && (t.class = it([t.class, s.class]));
      else if (i === "style")
        t.style = Mt([t.style, s.style]);
      else if (hn(i)) {
        const o = t[i], l = s[i];
        l && o !== l && !(V(o) && o.includes(l)) ? t[i] = o ? [].concat(o, l) : l : l == null && o == null && // mergeProps({ 'onUpdate:modelValue': undefined }) should not retain
        // the model listener.
        !gn(i) && (t[i] = l);
      } else i !== "" && (t[i] = s[i]);
  }
  return t;
}
function Ve(e, t, n, s = null) {
  We(e, t, 7, [
    n,
    s
  ]);
}
const Gl = Li();
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
    scope: new mo(
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
    propsDefaults: Q,
    // inheritAttrs
    inheritAttrs: s.inheritAttrs,
    // state
    ctx: Q,
    data: Q,
    props: Q,
    attrs: Q,
    slots: Q,
    refs: Q,
    setupState: Q,
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
let ve = null;
const Yl = () => ve || xe;
let dn, Kn;
{
  const e = mn(), t = (n, s) => {
    let i;
    return (i = e[n]) || (i = e[n] = []), i.push(s), (o) => {
      i.length > 1 ? i.forEach((l) => l(o)) : i[0](o);
    };
  };
  dn = t(
    "__VUE_INSTANCE_SETTERS__",
    (n) => ve = n
  ), Kn = t(
    "__VUE_SSR_SETTERS__",
    (n) => Gt = n
  );
}
const Yt = (e) => {
  const t = ve;
  return dn(e), e.scope.on(), () => {
    e.scope.off(), dn(t);
  };
}, Is = () => {
  ve && ve.scope.off(), dn(null);
};
function eo(e) {
  return e.vnode.shapeFlag & 4;
}
let Gt = !1;
function Xl(e, t = !1, n = !1) {
  t && Kn(t);
  const { props: s, children: i } = e.vnode, o = eo(e);
  Il(e, s, o, t), Ll(e, i, n || t);
  const l = o ? Ql(e, t) : void 0;
  return t && Kn(!1), l;
}
function Ql(e, t) {
  const n = e.type;
  e.accessCache = /* @__PURE__ */ Object.create(null), e.proxy = new Proxy(e.ctx, vl);
  const { setup: s } = n;
  if (s) {
    Qe();
    const i = e.setupContext = s.length > 1 ? er(e) : null, o = Yt(e), l = zt(
      s,
      e,
      0,
      [
        e.props,
        i
      ]
    ), r = Ys(l);
    if (Ze(), o(), (r || e.sp) && !jt(e) && Ri(e), r) {
      if (l.then(Is, Is), t)
        return l.then((u) => {
          Os(e, u);
        }).catch((u) => {
          yn(u, e, 0);
        });
      e.asyncDep = l;
    } else
      Os(e, l);
  } else
    to(e);
}
function Os(e, t, n) {
  $(t) ? e.type.__ssrInlineRender ? e.ssrRender = t : e.render = t : Y(t) && (e.setupState = _i(t)), to(e);
}
function to(e, t, n) {
  const s = e.type;
  e.render || (e.render = s.render || He);
  {
    const i = Yt(e);
    Qe();
    try {
      ml(e);
    } finally {
      Ze(), i();
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
function wn(e) {
  return e.exposed ? e.exposeProxy || (e.exposeProxy = new Proxy(_i(Do(e.exposed)), {
    get(t, n) {
      if (n in t)
        return t[n];
      if (n in Ht)
        return Ht[n](e);
    },
    has(t, n) {
      return n in t || n in Ht;
    }
  })) : e.proxy;
}
function tr(e) {
  return $(e) && "__vccOpts" in e;
}
const Ee = (e, t) => /* @__PURE__ */ Uo(e, t, Gt), nr = "3.5.34";
let qn;
const ks = typeof window < "u" && window.trustedTypes;
if (ks)
  try {
    qn = /* @__PURE__ */ ks.createPolicy("vue", {
      createHTML: (e) => e
    });
  } catch {
  }
const no = qn ? (e) => qn.createHTML(e) : (e) => e, sr = "http://www.w3.org/2000/svg", ir = "http://www.w3.org/1998/Math/MathML", Ge = typeof document < "u" ? document : null, Fs = Ge && /* @__PURE__ */ Ge.createElement("template"), or = {
  insert: (e, t, n) => {
    t.insertBefore(e, n || null);
  },
  remove: (e) => {
    const t = e.parentNode;
    t && t.removeChild(e);
  },
  createElement: (e, t, n, s) => {
    const i = t === "svg" ? Ge.createElementNS(sr, e) : t === "mathml" ? Ge.createElementNS(ir, e) : n ? Ge.createElement(e, { is: n }) : Ge.createElement(e);
    return e === "select" && s && s.multiple != null && i.setAttribute("multiple", s.multiple), i;
  },
  createText: (e) => Ge.createTextNode(e),
  createComment: (e) => Ge.createComment(e),
  setText: (e, t) => {
    e.nodeValue = t;
  },
  setElementText: (e, t) => {
    e.textContent = t;
  },
  parentNode: (e) => e.parentNode,
  nextSibling: (e) => e.nextSibling,
  querySelector: (e) => Ge.querySelector(e),
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
      Fs.innerHTML = no(
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
const Ls = /* @__PURE__ */ Symbol("_vod"), ar = /* @__PURE__ */ Symbol("_vsh"), cr = /* @__PURE__ */ Symbol(""), ur = /(?:^|;)\s*display\s*:/;
function fr(e, t, n) {
  const s = e.style, i = se(n);
  let o = !1;
  if (n && !i) {
    if (t)
      if (se(t))
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
        !se(t) && t ? t[l] : void 0,
        r
      ) || Lt(s, l, r) : Lt(s, l, "");
    }
  } else if (i) {
    if (t !== n) {
      const l = s[cr];
      l && (n += ";" + l), s.cssText = n, o = ur.test(n);
    }
  } else t && e.removeAttribute("style");
  Ls in e && (e[Ls] = o ? s.display : "", e[ar] && (s.display = "none"));
}
const Vs = /\s*!important$/;
function Lt(e, t, n) {
  if (V(n))
    n.forEach((s) => Lt(e, t, s));
  else if (n == null && (n = ""), t.startsWith("--"))
    e.setProperty(t, n);
  else {
    const s = dr(e, t);
    Vs.test(n) ? e.setProperty(
      ht(s),
      n.replace(Vs, ""),
      "important"
    ) : e[s] = n;
  }
}
const Ns = ["Webkit", "Moz", "ms"], kn = {};
function dr(e, t) {
  const n = kn[t];
  if (n)
    return n;
  let s = Pe(t);
  if (s !== "filter" && s in e)
    return kn[t] = s;
  s = Zs(s);
  for (let i = 0; i < Ns.length; i++) {
    const o = Ns[i] + s;
    if (o in e)
      return kn[t] = o;
  }
  return t;
}
function pr(e, t, n, s) {
  return e.tagName === "TEXTAREA" && (t === "width" || t === "height") && se(s) && n === s;
}
const Ds = "http://www.w3.org/1999/xlink";
function $s(e, t, n, s, i, o = go(t)) {
  s && t.startsWith("xlink:") ? n == null ? e.removeAttributeNS(Ds, t.slice(6, t.length)) : e.setAttributeNS(Ds, t, n) : n == null || o && !ti(n) ? e.removeAttribute(t) : e.setAttribute(
    t,
    o ? "" : Be(n) ? String(n) : n
  );
}
function js(e, t, n, s, i) {
  if (t === "innerHTML" || t === "textContent") {
    n != null && (e[t] = t === "innerHTML" ? no(n) : n);
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
function xt(e, t, n, s) {
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
      xt(e, r, p, u);
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
  return [e[2] === ":" ? e.slice(3) : ht(e.slice(2)), t];
}
let Fn = 0;
const mr = /* @__PURE__ */ Promise.resolve(), _r = () => Fn || (mr.then(() => Fn = 0), Fn = Date.now());
function yr(e, t) {
  const n = (s) => {
    if (!s._vts)
      s._vts = Date.now();
    else if (s._vts <= n.attached)
      return;
    We(
      br(s, n.value),
      t,
      5,
      [s]
    );
  };
  return n.value = e, n.attached = _r(), n;
}
function br(e, t) {
  if (V(t)) {
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
  t === "class" ? rr(e, s, l) : t === "style" ? fr(e, n, s) : hn(t) ? gn(t) || gr(e, t, n, s, o) : (t[0] === "." ? (t = t.slice(1), !0) : t[0] === "^" ? (t = t.slice(1), !1) : Sr(e, t, s, l)) ? (js(e, t, s), !e.tagName.includes("-") && (t === "value" || t === "checked" || t === "selected") && $s(e, t, s, l, o, t !== "value")) : /* #11081 force set props for possible async custom element */ e._isVueCE && // #12408 check if it's declared prop or it's async custom element
  (wr(e, t) || // @ts-expect-error _def is private
  e._def.__asyncLoader && (/[A-Z]/.test(t) || !se(s))) ? js(e, Pe(t), s, o, t) : (t === "true-value" ? e._trueValue = s : t === "false-value" && (e._falseValue = s), $s(e, t, s, l));
};
function Sr(e, t, n, s) {
  if (s)
    return !!(t === "innerHTML" || t === "textContent" || t in e && Ws(t) && $(n));
  if (t === "spellcheck" || t === "draggable" || t === "translate" || t === "autocorrect" || t === "sandbox" && e.tagName === "IFRAME" || t === "form" || t === "list" && e.tagName === "INPUT" || t === "type" && e.tagName === "TEXTAREA")
    return !1;
  if (t === "width" || t === "height") {
    const i = e.tagName;
    if (i === "IMG" || i === "VIDEO" || i === "CANVAS" || i === "SOURCE")
      return !1;
  }
  return Ws(t) && se(n) ? !1 : t in e;
}
function wr(e, t) {
  const n = (
    // @ts-expect-error _def is private
    e._def.props
  );
  if (!n)
    return !1;
  const s = Pe(t);
  return Array.isArray(n) ? n.some((i) => Pe(i) === s) : Object.keys(n).some((i) => Pe(i) === s);
}
const Us = (e) => {
  const t = e.props["onUpdate:modelValue"] || !1;
  return V(t) ? (n) => nn(t, n) : t;
};
function Mr(e) {
  e.target.composing = !0;
}
function Ks(e) {
  const t = e.target;
  t.composing && (t.composing = !1, t.dispatchEvent(new Event("input")));
}
const Ln = /* @__PURE__ */ Symbol("_assign");
function qs(e, t, n) {
  return t && (e = e.trim()), n && (e = Xn(e)), e;
}
const Cr = {
  created(e, { modifiers: { lazy: t, trim: n, number: s } }, i) {
    e[Ln] = Us(i);
    const o = s || i.props && i.props.type === "number";
    xt(e, t ? "change" : "input", (l) => {
      l.target.composing || e[Ln](qs(e.value, n, o));
    }), (n || o) && xt(e, "change", () => {
      e.value = qs(e.value, n, o);
    }), t || (xt(e, "compositionstart", Mr), xt(e, "compositionend", Ks), xt(e, "change", Ks));
  },
  // set value on mounted so it's after min/max for type="range"
  mounted(e, { value: t }) {
    e.value = t ?? "";
  },
  beforeUpdate(e, { value: t, oldValue: n, modifiers: { lazy: s, trim: i, number: o } }, l) {
    if (e[Ln] = Us(l), e.composing) return;
    const r = (o || e.type === "number") && !/^0\d/.test(e.value) ? Xn(e.value) : e.value, u = t ?? "";
    if (r === u)
      return;
    const p = e.getRootNode();
    (p instanceof Document || p instanceof ShadowRoot) && p.activeElement === e && e.type !== "range" && (s && t === n || i && e.value.trim() === u) || (e.value = u);
  }
}, Tr = /* @__PURE__ */ pe({ patchProp: xr }, or);
let Gs;
function Rr() {
  return Gs || (Gs = Nl(Tr));
}
const Ar = ((...e) => {
  const t = Rr().createApp(...e), { mount: n } = t;
  return t.mount = (s) => {
    const i = Pr(s);
    if (!i) return;
    const o = t._component;
    !$(o) && !o.render && !o.template && (o.template = i.innerHTML), i.nodeType === 1 && (i.textContent = "");
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
  return se(e) ? document.querySelector(e) : e;
}
function re() {
  return typeof window < "u" && window.openxnetApp || null;
}
function Mn(e) {
  if (e && typeof e.isCurrentLanguageZh == "function")
    try {
      return !!e.isCurrentLanguageZh();
    } catch {
      return !0;
    }
  return String(e?.currentLanguage || navigator.language || "zh-CN").toLowerCase().startsWith("zh");
}
function kt(e, t) {
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
function so(e, t, n = 2) {
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
function io(e, t) {
  if (e && typeof e.getRoleMemoryAvatarStyle == "function")
    try {
      const n = e.getRoleMemoryAvatarStyle(t);
      if (n && n.background)
        return n.background;
    } catch {
    }
  return "linear-gradient(135deg, #73c4ea 0%, #5aa7d1 100%)";
}
function pn(e, t, n = "success") {
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
  await Ue(e);
}
async function kr(e, t) {
  if (!t) return;
  const n = Mn(e);
  if (t.type && !String(t.type).startsWith("image/")) {
    pn(e, n ? "请选择图片文件" : "Please select an image file", "warning");
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
  await Or(e, l), pn(e, n ? "头像已更新" : "Avatar updated", "success");
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
    avatarText: so(e, i, 2),
    avatarImage: String(i?.avatar || ""),
    avatarBackground: io(e, i),
    active: s === String(i?.id || "")
  }));
}
function Lr(e, t) {
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
    avatarText: so(e, n, 3),
    avatarImage: String(n?.avatar || ""),
    avatarBackground: io(e, n),
    providerId: String(n?.providerId || ""),
    providerOptions: Lr(e, t),
    memoryEnabled: !!s?.is_memory,
    memoryLimit: Number(s?.memoryLimit || 10),
    userName: String(s?.userName || "user"),
    genericSystemPrompt: String(s?.genericSystemPrompt || ""),
    backendLabel: e && typeof e.getPrototypeMemoryBackendLabel == "function" ? e.getPrototypeMemoryBackendLabel() : t ? "Session Store（本地 JSON / 时间线）" : "Session Store (local JSON / timeline)"
  };
}
function Nr(e, t) {
  const n = e?.ttsSettings || {}, s = String(n.engine || "edgetts"), o = (Array.isArray(e?.edgettsvoices) ? e.edgettsvoices : []).filter((p) => {
    const d = !n.edgettsLanguage || p.language === n.edgettsLanguage, g = !n.edgettsGender || p.gender === n.edgettsGender;
    return d && g;
  }).slice(0, 40).map((p) => ({
    value: p.name,
    label: `${p.name} · ${p.language} · ${p.gender}`
  })), l = s === "systemtts" ? (e?.systemVoices || []).map((p) => ({ value: p.id, label: p.name || p.id })) : s === "openai" ? (e?.openaiVoices || []).map((p) => ({ value: p, label: p })) : o, r = s === "systemtts" ? "systemVoiceName" : s === "openai" ? "openaiVoice" : "edgettsVoice", u = s === "systemtts" ? "systemRate" : s === "openai" ? "openaiSpeed" : "edgettsRate";
  return {
    engine: s,
    voiceField: r,
    rateField: u,
    rateMin: s === "systemtts" ? 50 : 0.5,
    rateMax: s === "systemtts" ? 400 : 2,
    rateStep: s === "systemtts" ? 10 : 0.1,
    providers: [
      { id: "edgetts", label: "Edge TTS", active: String(n.engine || "edgetts") === "edgetts" },
      { id: "openai", label: "OpenAI TTS", active: String(n.engine || "") === "openai" },
      { id: "systemtts", label: t ? "系统语音" : "System Voice", active: String(n.engine || "") === "systemtts" }
    ],
    rows: Object.entries(n.newtts || {}).filter(([, p]) => p && typeof p == "object").map(([p, d]) => {
      const g = { ...n, ...d }, R = String(g.engine || "edgetts"), E = R === "openai" ? g.openaiVoice : R === "systemtts" ? g.systemVoiceName : R === "edgetts" ? g.edgettsVoice : g.voice, j = R === "openai" ? g.openaiSpeed : R === "edgetts" ? g.edgettsRate : g.speed;
      return {
        id: p,
        name: p,
        model: R,
        tone: String(E || "—"),
        speed: Number.isFinite(Number(j)) && Number(j) > 0 ? `${Number(j).toFixed(1)}x` : "—",
        pitch: g.edgettsPitch === void 0 || R !== "edgetts" ? "—" : String(g.edgettsPitch)
      };
    }),
    selectedLanguage: String(n.edgettsLanguage || "zh-CN"),
    selectedGender: String(n.edgettsGender || "Female"),
    selectedVoice: String(n[r] || ""),
    selectedRate: Number(n[u] || (s === "systemtts" ? 200 : 1)),
    sampleText: String(n.SampleText || (t ? "openxnet链接一切！" : "OpenXnet connects everything.")),
    voiceOptions: l
  };
}
function Dr(e, t, n) {
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
  const e = re(), t = Mn(e), n = Fr(e, t);
  return {
    isZh: t,
    activeMenu: String(e?.activeMenu || ""),
    activeTab: String(e?.subMenu || "memory"),
    tabs: [
      { id: "memory", label: kt("memory", t), icon: "fa-solid fa-brain" },
      { id: "voice", label: kt("voice", t), icon: "fa-solid fa-microphone" },
      { id: "appearance", label: kt("appearance", t), icon: "fa-solid fa-palette" },
      { id: "behavior", label: kt("behavior", t), icon: "fa-solid fa-wand-magic-sparkles" },
      { id: "vision", label: kt("vision", t), icon: "fa-solid fa-eye" }
    ],
    roles: n,
    memory: Vr(e, t),
    voice: Nr(e, t),
    appearance: Dr(e, n, t),
    behavior: $r(e, t),
    vision: jr(e, t)
  };
}
async function Ue(e) {
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
        await kr(e, s);
      } catch (i) {
        console.error("[role-vite] avatar upload failed:", i), pn(
          e,
          Mn(e) ? `头像上传失败：${i?.message || i}` : `Avatar upload failed: ${i?.message || i}`,
          "error"
        );
      }
  }, { once: !0 }), document.body.appendChild(t), t.click();
}
async function Jr(e, t) {
  const n = re();
  !n || !n.newMemory || (n.newMemory[e] = t, await Ue(n));
}
async function zr(e, t) {
  const n = re();
  if (!(!n || !n.memorySettings)) {
    if (n.memorySettings[e] = t, e === "is_memory" && typeof n.changeMemory == "function") {
      n.changeMemory();
      return;
    }
    await Ue(n);
  }
}
async function Yr(e) {
  const t = re();
  !t || !t.newMemory || (t.newMemory.providerId = e || null, typeof t.selectMemoryProvider == "function" && t.selectMemoryProvider(t.newMemory.providerId), await Ue(t));
}
async function Xr(e, t) {
  const n = re();
  !n || !n.ttsSettings || (n.ttsSettings[e] = ["edgettsRate", "openaiSpeed", "systemRate"].includes(e) ? Number(t) : t, e === "edgettsLanguage" && (n.edgettsLanguage = t), e === "edgettsGender" && (n.edgettsGender = t), await Ue(n));
}
async function Qr(e) {
  const t = re();
  !t?.ttsSettings || !["edgetts", "openai", "systemtts"].includes(e) || (t.ttsSettings.engine = e, await Ue(t), e === "systemtts" && typeof t.fetchSystemVoices == "function" ? await t.fetchSystemVoices() : e !== "systemtts" && typeof t.fetchTetosVoices == "function" && await t.fetchTetosVoices(e));
}
async function Zr(e = "default") {
  const t = re();
  if (!t || typeof t.ClickToListen != "function") return;
  const n = e === "default" ? t.ttsSettings : t.ttsSettings?.newtts?.[e];
  if (!n) return;
  const s = n.SampleText || t.ttsSettings?.SampleText || "openxnet链接一切！";
  await t.ClickToListen(s, e);
}
async function ea() {
  const e = re();
  e && (e.showVrmModelDialog = !0);
}
async function ta(e, t) {
  const n = re();
  if (!(!n || !n.VRMConfig)) {
    if (n.VRMConfig[e] = t, typeof n.saveVRMConfig == "function") {
      await n.saveVRMConfig();
      return;
    }
    await Ue(n);
  }
}
async function na(e) {
  const t = re();
  if (!t || !Array.isArray(t.behaviorSettings?.behaviorList)) return;
  const n = t.behaviorSettings.behaviorList[e];
  n && (n.enabled = !n.enabled, await Ue(t));
}
async function sa() {
  const e = re();
  e && (typeof e.openBehaviorDialog == "function" ? e.openBehaviorDialog(-1) : pn(e, Mn(e) ? "行为编辑器暂时不可用，请重新打开角色设置。" : "The behavior editor is unavailable. Reopen Role Settings.", "error"));
}
async function ia(e, t) {
  const n = re();
  !n || !n.visionSettings || (n.visionSettings[e] = t, await Ue(n));
}
async function oa(e) {
  const t = re();
  if (!(!t || !t.visionSettings)) {
    if (t.visionSettings.selectedProvider = e || null, typeof t.selectVisionProvider == "function") {
      await t.selectVisionProvider(t.visionSettings.selectedProvider);
      return;
    }
    await Ue(t);
  }
}
function la() {
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
    selectVoiceEngine: Qr,
    playVoiceSample: Zr,
    openVrmUpload: ea,
    updateVrmField: ta,
    toggleBehaviorRule: na,
    openBehaviorEditor: sa,
    updateVisionField: ia,
    updateVisionProvider: oa
  };
}
const ra = { class: "ox-vite-role-shell" }, aa = { class: "ox-vite-role-tabs" }, ca = ["onClick"], ua = {
  key: 0,
  class: "ox-vite-role-content ox-vite-role-content--memory"
}, fa = { class: "ox-vite-role-sidebar" }, da = { class: "ox-vite-role-sidebar__header" }, pa = { class: "ox-vite-role-sidebar__title-row" }, ha = { class: "ox-vite-role-search" }, ga = ["placeholder"], va = ["onClick"], ma = { class: "ox-vite-role-card__top" }, _a = ["src", "alt"], ya = { key: 1 }, ba = { class: "ox-vite-role-card__copy" }, xa = { class: "ox-vite-role-card__name-row" }, Sa = { class: "ox-vite-role-card__name" }, wa = { class: "ox-vite-role-card__desc" }, Ma = { class: "ox-vite-role-card__meta" }, Ca = {
  key: 0,
  class: "ox-vite-role-empty"
}, Ta = { class: "ox-vite-role-editor" }, Ra = { class: "ox-vite-role-editor__header" }, Aa = { class: "ox-vite-role-editor__actions" }, Ea = { class: "ox-vite-role-editor__lead" }, Pa = { class: "ox-vite-role-avatar-panel" }, Ia = { class: "ox-vite-role-avatar-upload" }, Oa = ["src", "alt"], ka = { key: 1 }, Fa = { class: "ox-vite-role-avatar-upload__overlay" }, La = { class: "ox-vite-role-avatar-panel__copy" }, Va = { class: "ox-vite-role-tags" }, Na = { class: "ox-vite-role-tag" }, Da = { class: "ox-vite-role-tag" }, $a = { class: "ox-vite-role-tag" }, ja = { class: "ox-vite-role-form" }, Ha = { class: "ox-vite-role-field ox-vite-role-field--name" }, Ba = ["value", "placeholder"], Wa = { class: "ox-vite-role-field ox-vite-role-field--full" }, Ua = ["value", "placeholder"], Ka = { class: "ox-vite-role-field ox-vite-role-field--full" }, qa = ["value", "placeholder"], Ga = { class: "ox-vite-role-field ox-vite-role-field--full" }, Ja = ["value", "placeholder"], za = { class: "ox-vite-role-field ox-vite-role-field--full" }, Ya = ["value"], Xa = { class: "ox-vite-role-field" }, Qa = ["value"], Za = ["value"], ec = { class: "ox-vite-role-field" }, tc = { class: "ox-vite-role-slider-row" }, nc = ["value"], sc = { class: "ox-vite-role-switch-grid" }, ic = { class: "ox-vite-role-switch" }, oc = ["checked"], lc = { class: "ox-vite-role-switch" }, rc = ["checked"], ac = { class: "ox-vite-role-field" }, cc = ["value"], uc = { class: "ox-vite-role-field ox-vite-role-field--full" }, fc = ["value"], dc = {
  key: 1,
  class: "ox-vite-role-content ox-vite-role-content--panel"
}, pc = { class: "ox-vite-role-panel" }, hc = { class: "ox-vite-role-section-header" }, gc = { class: "ox-vite-role-provider-cards" }, vc = ["aria-pressed", "disabled", "onClick"], mc = { class: "ox-vite-role-table-wrap" }, _c = { class: "ox-vite-role-table" }, yc = ["aria-label", "onClick"], bc = { key: 0 }, xc = { colspan: "6" }, Sc = { class: "ox-vite-role-panel-grid ox-vite-role-panel-grid--voice" }, wc = {
  key: 0,
  class: "ox-vite-role-field"
}, Mc = ["value"], Cc = {
  key: 1,
  class: "ox-vite-role-field"
}, Tc = ["value"], Rc = { value: "Female" }, Ac = { value: "Male" }, Ec = { class: "ox-vite-role-field" }, Pc = ["value"], Ic = {
  key: 0,
  value: ""
}, Oc = ["value"], kc = { class: "ox-vite-role-field" }, Fc = ["value", "min", "max", "step"], Lc = { class: "ox-vite-role-field ox-vite-role-field--full" }, Vc = ["value"], Nc = {
  key: 2,
  class: "ox-vite-role-content ox-vite-role-content--panel"
}, Dc = { class: "ox-vite-role-panel" }, $c = { class: "ox-vite-role-section-header" }, jc = { class: "ox-vite-role-avatar-grid" }, Hc = ["src", "alt"], Bc = { key: 1 }, Wc = { class: "ox-vite-role-avatar-card__name" }, Uc = { class: "ox-vite-role-vrm-section" }, Kc = { class: "ox-vite-role-vrm-meta" }, qc = { class: "ox-vite-role-field" }, Gc = ["value"], Jc = { value: "" }, zc = ["value"], Yc = { class: "ox-vite-role-inline-stats" }, Xc = { class: "ox-vite-role-switch-grid" }, Qc = { class: "ox-vite-role-switch" }, Zc = ["checked"], eu = { class: "ox-vite-role-switch" }, tu = ["checked"], nu = {
  key: 3,
  class: "ox-vite-role-content ox-vite-role-content--panel"
}, su = { class: "ox-vite-role-panel" }, iu = { class: "ox-vite-role-section-header" }, ou = { class: "ox-vite-role-behavior-list" }, lu = { class: "ox-vite-role-behavior-card__copy" }, ru = { class: "ox-vite-role-behavior-card__meta" }, au = ["checked", "onChange"], cu = {
  key: 1,
  class: "ox-vite-role-demo-badge"
}, uu = {
  key: 4,
  class: "ox-vite-role-content ox-vite-role-content--panel"
}, fu = { class: "ox-vite-role-panel" }, du = { class: "ox-vite-role-section-header" }, pu = { class: "ox-vite-role-settings-grid" }, hu = { class: "ox-vite-role-switch" }, gu = ["checked"], vu = { class: "ox-vite-role-field" }, mu = ["value"], _u = { class: "ox-vite-role-field" }, yu = ["value"], bu = { class: "ox-vite-role-settings-grid" }, xu = { class: "ox-vite-role-field" }, Su = ["value"], wu = { value: "" }, Mu = ["value"], Cu = { class: "ox-vite-role-field" }, Tu = ["value"], Ru = { class: "ox-vite-role-settings-grid" }, Au = { class: "ox-vite-role-switch" }, Eu = ["checked"], Pu = { class: "ox-vite-role-field ox-vite-role-field--full" }, Iu = ["value"], Ou = { class: "ox-vite-role-field ox-vite-role-field--full" }, ku = { class: "ox-vite-role-chip-wrap" }, Fu = {
  __name: "App",
  setup(e) {
    const t = la(), n = /* @__PURE__ */ en(t.snapshot()), s = /* @__PURE__ */ en(null);
    let i = null;
    const o = /* @__PURE__ */ en(!1);
    function l() {
      bi(() => {
        const k = s.value;
        k && (k.scrollTop = 0);
      });
    }
    function r() {
      n.value = t.snapshot();
    }
    function u(k) {
      t.selectTab(k), r();
    }
    function p() {
      t.createRole(), r();
    }
    function d(k) {
      t.selectRole(k), r(), l();
    }
    function g(k, w) {
      t.updateRoleField(k, w.target.value);
    }
    function R(k) {
      t.updateRoleField("infer", k.target.checked);
    }
    function E(k) {
      t.updateMemorySetting("is_memory", k.target.checked);
    }
    function j(k) {
      t.updateMemorySetting("memoryLimit", Number(k.target.value));
    }
    function F(k, w) {
      t.updateMemorySetting(k, w.target.value);
    }
    function ne(k) {
      t.updateMemoryProvider(k.target.value);
    }
    function Z() {
      t.saveRole(), r();
    }
    function H() {
      t.deleteRole(), r();
    }
    function q() {
      t.triggerAvatarUpload(), window.setTimeout(r, 500);
    }
    function I(k, w) {
      t.updateTtsField(k, w.target.value), r();
    }
    async function ie(k) {
      if (!o.value) {
        o.value = !0;
        try {
          await t.selectVoiceEngine(k);
        } catch (w) {
          window.showNotification?.(w?.message || (S.value ? "语音引擎切换失败" : "Could not change the voice engine"), "error");
        } finally {
          o.value = !1, r();
        }
      }
    }
    function we(k = "default") {
      t.playVoiceSample(k);
    }
    function be() {
      t.openVrmUpload();
    }
    function Me(k, w) {
      t.updateVrmField(k, w.target.checked), r();
    }
    function gt(k) {
      t.updateVrmField("selectedModelId", k.target.value), r();
    }
    function Ke(k) {
      t.toggleBehaviorRule(k), r();
    }
    function lt() {
      t.openBehaviorEditor();
    }
    function rt(k, w) {
      t.updateVisionField(k, w.target.checked), r();
    }
    function vt(k, w) {
      t.updateVisionField(k, w.target.value);
    }
    function Et(k) {
      t.updateVisionProvider(k.target.value), r();
    }
    const S = Ee(() => n.value.isZh), ae = Ee(() => n.value.tabs || []), G = Ee(() => n.value.activeTab || "memory"), J = Ee(() => n.value.roles || []), Ce = /* @__PURE__ */ en(""), at = Ee(() => {
      const k = Ce.value.trim().toLowerCase();
      return k ? J.value.filter((w) => [
        w.name,
        w.description,
        w.meta,
        w.badge,
        w.avatarText
      ].join(" ").toLowerCase().includes(k)) : J.value;
    }), B = Ee(() => n.value.memory || {}), z = Ee(() => n.value.voice || {}), Te = Ee(() => n.value.appearance || {}), Xt = Ee(() => n.value.behavior || {}), Re = Ee(() => n.value.vision || {});
    return Pi(() => {
      r(), l(), i = window.setInterval(r, 400);
    }), on(
      () => n.value.activeMenu,
      (k, w) => {
        k === "role" && w !== "role" && l();
      }
    ), Ii(() => {
      i && (window.clearInterval(i), i = null);
    }), (k, w) => (N(), D("div", ra, [
      a("div", aa, [
        (N(!0), D(le, null, Ae(ae.value, (m) => (N(), D("button", {
          key: m.id,
          type: "button",
          class: it(["ox-vite-role-tab", { active: G.value === m.id }]),
          onClick: (nt) => u(m.id)
        }, [
          a("i", {
            class: it(m.icon)
          }, null, 2),
          a("span", null, v(m.label), 1)
        ], 10, ca))), 128))
      ]),
      G.value === "memory" ? (N(), D("div", ua, [
        a("aside", fa, [
          a("div", da, [
            a("div", pa, [
              a("h2", null, v(S.value ? "角色管理" : "Role Management"), 1),
              a("button", {
                type: "button",
                class: "ox-vite-role-primary-btn",
                onClick: p
              }, [
                w[19] || (w[19] = a("i", { class: "fa-solid fa-plus" }, null, -1)),
                a("span", null, v(S.value ? "新建角色" : "New Role"), 1)
              ])
            ]),
            a("div", ha, [
              w[20] || (w[20] = a("i", { class: "fa-solid fa-magnifying-glass" }, null, -1)),
              Xo(a("input", {
                "onUpdate:modelValue": w[0] || (w[0] = (m) => Ce.value = m),
                type: "text",
                placeholder: S.value ? "搜索角色..." : "Search roles..."
              }, null, 8, ga), [
                [Cr, Ce.value]
              ])
            ])
          ]),
          a("div", {
            ref_key: "roleListRef",
            ref: s,
            class: "ox-vite-role-list"
          }, [
            (N(!0), D(le, null, Ae(at.value, (m) => (N(), D("button", {
              key: m.id,
              type: "button",
              class: it(["ox-vite-role-card", { active: m.active }]),
              onClick: (nt) => d(m.id)
            }, [
              a("div", ma, [
                a("div", {
                  class: "ox-vite-role-card__avatar",
                  style: Mt({ background: m.avatarBackground })
                }, [
                  m.avatarImage ? (N(), D("img", {
                    key: 0,
                    src: m.avatarImage,
                    alt: m.name
                  }, null, 8, _a)) : (N(), D("span", ya, v(m.avatarText), 1))
                ], 4),
                a("div", ba, [
                  a("div", xa, [
                    a("span", Sa, v(m.name), 1),
                    a("span", {
                      class: it(["ox-vite-role-card__badge", `is-${m.badgeTone}`])
                    }, v(m.badge), 3)
                  ]),
                  a("div", wa, v(m.description), 1)
                ])
              ]),
              a("div", Ma, v(m.meta), 1)
            ], 10, va))), 128)),
            at.value.length === 0 ? (N(), D("div", Ca, [
              w[21] || (w[21] = a("i", { class: "fa-regular fa-user" }, null, -1)),
              a("span", null, v(S.value ? "没有匹配的角色" : "No matching roles"), 1)
            ])) : yt("", !0)
          ], 512)
        ]),
        a("main", Ta, [
          a("div", Ra, [
            a("h1", null, v(B.value.title), 1),
            a("div", Aa, [
              B.value.canDelete ? (N(), D("button", {
                key: 0,
                type: "button",
                class: "ox-vite-role-danger-btn",
                onClick: H
              }, [
                w[22] || (w[22] = a("i", { class: "fa-solid fa-trash-can" }, null, -1)),
                a("span", null, v(S.value ? "删除" : "Delete"), 1)
              ])) : yt("", !0),
              a("button", {
                type: "button",
                class: "ox-vite-role-primary-btn",
                onClick: Z
              }, [
                w[23] || (w[23] = a("i", { class: "fa-solid fa-check" }, null, -1)),
                a("span", null, v(S.value ? "保存" : "Save"), 1)
              ])
            ])
          ]),
          a("div", Ea, [
            a("aside", Pa, [
              a("div", Ia, [
                a("button", {
                  type: "button",
                  class: "ox-vite-role-avatar-upload__circle",
                  style: Mt({ background: B.value.avatarBackground }),
                  onClick: q
                }, [
                  B.value.avatarImage ? (N(), D("img", {
                    key: 0,
                    src: B.value.avatarImage,
                    alt: B.value.name
                  }, null, 8, Oa)) : (N(), D("span", ka, v(B.value.avatarText), 1)),
                  a("div", Fa, [
                    w[24] || (w[24] = a("i", { class: "fa-solid fa-camera" }, null, -1)),
                    a("span", null, v(S.value ? "更换头像" : "Change avatar"), 1)
                  ])
                ], 4),
                a("button", {
                  type: "button",
                  class: "ox-vite-role-avatar-upload__button",
                  onClick: q
                }, [
                  w[25] || (w[25] = a("i", { class: "fa-solid fa-cloud-arrow-up" }, null, -1)),
                  a("span", null, v(S.value ? "上传头像" : "Upload avatar"), 1)
                ])
              ]),
              a("div", La, [
                a("strong", null, v(S.value ? "角色概览" : "Role Overview"), 1),
                a("p", null, v(B.value.canDelete ? S.value ? "当前角色已接入角色库，可继续编辑并保存。" : "This role already exists in the library and can be refined here." : S.value ? "新角色会在保存后加入角色库。" : "A new role will be added to the library after saving."), 1)
              ]),
              a("div", Va, [
                a("span", Na, v(B.value.memoryEnabled ? S.value ? "长记忆开启" : "Memory On" : S.value ? "长记忆关闭" : "Memory Off"), 1),
                a("span", Da, v(B.value.infer ? S.value ? "自动推理" : "Infer" : S.value ? "手动维护" : "Manual"), 1),
                a("span", $a, v(B.value.backendLabel), 1)
              ])
            ]),
            a("div", ja, [
              a("label", Ha, [
                a("span", null, v(S.value ? "角色名称" : "Role name"), 1),
                a("input", {
                  value: B.value.name,
                  type: "text",
                  placeholder: S.value ? "例如：智能助手" : "e.g. Assistant",
                  onInput: w[1] || (w[1] = (m) => g("name", m))
                }, null, 40, Ba)
              ]),
              a("label", Wa, [
                a("span", null, v(S.value ? "描述" : "Description"), 1),
                a("textarea", {
                  value: B.value.description,
                  rows: "3",
                  placeholder: S.value ? "说明这个角色主要负责什么、适合什么场景。" : "Describe what this role does and when to use it.",
                  onInput: w[2] || (w[2] = (m) => g("description", m))
                }, null, 40, Ua)
              ]),
              a("label", Ka, [
                a("span", null, v(S.value ? "性格设定" : "Personality setting"), 1),
                a("textarea", {
                  value: B.value.personality,
                  rows: "3",
                  placeholder: S.value ? "例如：表达清晰、耐心、直接，回答前先拆解问题，避免夸张和空泛表述。" : "e.g. Clear, patient, direct, breaks down the problem first, avoids vague wording.",
                  onInput: w[3] || (w[3] = (m) => g("personality", m))
                }, null, 40, qa)
              ]),
              a("label", Ga, [
                a("span", null, v(S.value ? "系统提示词" : "System prompt"), 1),
                a("textarea", {
                  value: B.value.systemPrompt,
                  rows: "7",
                  placeholder: S.value ? "定义角色身份、职责边界、决策规则和输出风格。" : "Define identity, responsibilities, boundaries, decision rules, and output style.",
                  onInput: w[4] || (w[4] = (m) => g("systemPrompt", m))
                }, null, 40, Ja)
              ]),
              a("label", za, [
                a("span", null, v(S.value ? "开场白" : "First greeting"), 1),
                a("textarea", {
                  value: B.value.firstMes,
                  rows: "3",
                  onInput: w[5] || (w[5] = (m) => g("firstMes", m))
                }, null, 40, Ya)
              ]),
              a("label", Xa, [
                a("span", null, v(S.value ? "绑定记忆模型" : "Memory model binding"), 1),
                a("select", {
                  value: B.value.providerId,
                  onChange: ne
                }, [
                  (N(!0), D(le, null, Ae(B.value.providerOptions, (m) => (N(), D("option", {
                    key: m.value,
                    value: m.value
                  }, v(m.label), 9, Za))), 128))
                ], 40, Qa)
              ]),
              a("div", ec, [
                a("span", null, v(S.value ? "长记忆检索数量" : "Memory result count"), 1),
                a("div", tc, [
                  a("input", {
                    value: B.value.memoryLimit,
                    type: "range",
                    min: "1",
                    max: "20",
                    step: "1",
                    onInput: j
                  }, null, 40, nc),
                  a("strong", null, v(B.value.memoryLimit), 1)
                ])
              ]),
              a("div", sc, [
                a("label", ic, [
                  a("span", null, [
                    a("strong", null, v(S.value ? "启用长记忆" : "Enable memory"), 1),
                    a("small", null, v(B.value.backendLabel), 1)
                  ]),
                  a("input", {
                    checked: B.value.memoryEnabled,
                    type: "checkbox",
                    onChange: E
                  }, null, 40, oc)
                ]),
                a("label", lc, [
                  a("span", null, [
                    a("strong", null, v(S.value ? "自动推理更新" : "Auto infer"), 1),
                    a("small", null, v(S.value ? "生成时补充角色记忆" : "Update memory while generating"), 1)
                  ]),
                  a("input", {
                    checked: B.value.infer,
                    type: "checkbox",
                    onChange: R
                  }, null, 40, rc)
                ])
              ]),
              a("label", ac, [
                a("span", null, v(S.value ? "用户称呼" : "User label"), 1),
                a("input", {
                  value: B.value.userName,
                  type: "text",
                  onInput: w[6] || (w[6] = (m) => F("userName", m))
                }, null, 40, cc)
              ]),
              a("label", uc, [
                a("span", null, v(S.value ? "通用系统提示" : "Generic system prompt"), 1),
                a("textarea", {
                  value: B.value.genericSystemPrompt,
                  rows: "4",
                  onInput: w[7] || (w[7] = (m) => F("genericSystemPrompt", m))
                }, null, 40, fc)
              ])
            ])
          ])
        ])
      ])) : G.value === "voice" ? (N(), D("div", dc, [
        a("section", pc, [
          a("div", hc, [
            a("h1", null, v(S.value ? "多角色语音配置" : "Multi-role Voice"), 1),
            a("p", null, v(S.value ? "为每个角色配置独立的语音合成方案" : "Assign voice synthesis settings across roles."), 1)
          ]),
          a("h2", null, v(S.value ? "语音供应商" : "Voice Providers"), 1),
          a("div", gc, [
            (N(!0), D(le, null, Ae(z.value.providers, (m) => (N(), D("button", {
              key: m.id,
              type: "button",
              class: it(["ox-vite-role-provider-card", { active: m.active }]),
              "aria-pressed": m.active,
              disabled: o.value,
              onClick: (nt) => ie(m.id)
            }, [
              w[26] || (w[26] = a("i", { class: "fa-solid fa-waveform-lines" }, null, -1)),
              a("span", null, v(m.label), 1)
            ], 10, vc))), 128))
          ]),
          a("h2", null, v(S.value ? "已保存的角色语音" : "Saved Role Voices"), 1),
          a("div", mc, [
            a("table", _c, [
              a("thead", null, [
                a("tr", null, [
                  a("th", null, v(S.value ? "角色" : "Role"), 1),
                  a("th", null, v(S.value ? "语音模型" : "Voice Model"), 1),
                  a("th", null, v(S.value ? "音色" : "Tone"), 1),
                  a("th", null, v(S.value ? "语速" : "Speed"), 1),
                  a("th", null, v(S.value ? "音调" : "Pitch"), 1),
                  a("th", null, v(S.value ? "试听" : "Preview"), 1)
                ])
              ]),
              a("tbody", null, [
                (N(!0), D(le, null, Ae(z.value.rows, (m) => (N(), D("tr", {
                  key: m.id
                }, [
                  a("td", null, [
                    a("strong", null, v(m.name), 1)
                  ]),
                  a("td", null, v(m.model), 1),
                  a("td", null, v(m.tone), 1),
                  a("td", null, v(m.speed), 1),
                  a("td", null, v(m.pitch), 1),
                  a("td", null, [
                    a("button", {
                      type: "button",
                      class: "ox-vite-role-play-btn",
                      "aria-label": (S.value ? "试听 " : "Preview ") + m.name,
                      onClick: (nt) => we(m.id)
                    }, [...w[27] || (w[27] = [
                      a("i", { class: "fa-solid fa-play" }, null, -1)
                    ])], 8, yc)
                  ])
                ]))), 128)),
                z.value.rows.length ? yt("", !0) : (N(), D("tr", bc, [
                  a("td", xc, v(S.value ? "尚未保存角色语音，可先使用下方的默认语音。" : "No saved role voices. Use the default voice below."), 1)
                ]))
              ])
            ])
          ]),
          a("h2", null, v(S.value ? "全局设置" : "Global Settings"), 1),
          a("button", {
            type: "button",
            class: "ox-vite-role-secondary-btn",
            onClick: w[8] || (w[8] = (m) => we("default"))
          }, [
            w[28] || (w[28] = a("i", { class: "fa-solid fa-play" }, null, -1)),
            Zi(v(S.value ? "试听默认语音" : "Preview default voice"), 1)
          ]),
          a("div", Sc, [
            z.value.engine === "edgetts" ? (N(), D("label", wc, [
              a("span", null, v(S.value ? "语言" : "Language"), 1),
              a("input", {
                value: z.value.selectedLanguage,
                type: "text",
                onInput: w[9] || (w[9] = (m) => I("edgettsLanguage", m))
              }, null, 40, Mc)
            ])) : yt("", !0),
            z.value.engine === "edgetts" ? (N(), D("label", Cc, [
              a("span", null, v(S.value ? "性别" : "Gender"), 1),
              a("select", {
                value: z.value.selectedGender,
                onChange: w[10] || (w[10] = (m) => I("edgettsGender", m))
              }, [
                a("option", Rc, v(S.value ? "女声" : "Female"), 1),
                a("option", Ac, v(S.value ? "男声" : "Male"), 1)
              ], 40, Tc)
            ])) : yt("", !0),
            a("label", Ec, [
              a("span", null, v(S.value ? "默认音色" : "Default Voice"), 1),
              a("select", {
                value: z.value.selectedVoice,
                onChange: w[11] || (w[11] = (m) => I(z.value.voiceField, m))
              }, [
                z.value.voiceOptions.length ? yt("", !0) : (N(), D("option", Ic, v(S.value ? "暂无可用音色" : "No voices available"), 1)),
                (N(!0), D(le, null, Ae(z.value.voiceOptions, (m) => (N(), D("option", {
                  key: m.value,
                  value: m.value
                }, v(m.label), 9, Oc))), 128))
              ], 40, Pc)
            ]),
            a("label", kc, [
              a("span", null, v(S.value ? "默认语速" : "Default Rate"), 1),
              a("input", {
                value: z.value.selectedRate,
                type: "number",
                min: z.value.rateMin,
                max: z.value.rateMax,
                step: z.value.rateStep,
                onInput: w[12] || (w[12] = (m) => I(z.value.rateField, m))
              }, null, 40, Fc)
            ]),
            a("label", Lc, [
              a("span", null, v(S.value ? "试听文本" : "Sample Text"), 1),
              a("textarea", {
                value: z.value.sampleText,
                rows: "3",
                onInput: w[13] || (w[13] = (m) => I("SampleText", m))
              }, null, 40, Vc)
            ])
          ])
        ])
      ])) : G.value === "appearance" ? (N(), D("div", Nc, [
        a("section", Dc, [
          a("div", $c, [
            a("h1", null, v(S.value ? "多角色外观配置" : "Multi-role Appearance"), 1),
            a("p", null, v(S.value ? "自定义每个角色的形象和动画表现" : "Customize each role avatar and motion presence."), 1)
          ]),
          a("h2", null, v(S.value ? "角色形象" : "Role Avatars"), 1),
          a("div", jc, [
            (N(!0), D(le, null, Ae(Te.value.avatars, (m) => (N(), D("article", {
              key: m.id,
              class: "ox-vite-role-avatar-card"
            }, [
              a("div", {
                class: "ox-vite-role-avatar-card__img",
                style: Mt({ background: m.avatarBackground })
              }, [
                m.avatarImage ? (N(), D("img", {
                  key: 0,
                  src: m.avatarImage,
                  alt: m.name
                }, null, 8, Hc)) : (N(), D("span", Bc, v(m.shortName), 1))
              ], 4),
              a("span", Wc, v(m.name), 1),
              a("button", {
                type: "button",
                class: "ox-vite-role-secondary-btn",
                onClick: q
              }, [
                w[29] || (w[29] = a("i", { class: "fa-solid fa-arrows-rotate" }, null, -1)),
                a("span", null, v(S.value ? "更换形象" : "Change"), 1)
              ])
            ]))), 128))
          ]),
          a("h2", null, v(S.value ? "VRM 模型配置" : "VRM Model"), 1),
          a("div", Uc, [
            a("button", {
              type: "button",
              class: "ox-vite-role-vrm-upload",
              onClick: be
            }, [
              w[30] || (w[30] = a("i", { class: "fa-solid fa-cloud-arrow-up" }, null, -1)),
              a("span", null, v(S.value ? "拖拽或点击上传 VRM 文件" : "Upload VRM file"), 1),
              a("small", null, v(S.value ? "支持 .vrm 格式，最大 50MB" : "Supports .vrm up to 50MB"), 1)
            ]),
            a("div", Kc, [
              a("label", qc, [
                a("span", null, v(S.value ? "当前模型" : "Current Model"), 1),
                a("select", {
                  value: Te.value.selectedModelId,
                  onChange: gt
                }, [
                  a("option", Jc, v(S.value ? "未选择模型" : "No model selected"), 1),
                  (N(!0), D(le, null, Ae(Te.value.modelOptions, (m) => (N(), D("option", {
                    key: m.value,
                    value: m.value
                  }, v(m.label), 9, zc))), 128))
                ], 40, Gc)
              ]),
              a("div", Yc, [
                a("div", null, [
                  a("strong", null, v(Te.value.motionCount), 1),
                  a("span", null, v(S.value ? "动作映射" : "motions"), 1)
                ]),
                a("div", null, [
                  a("strong", null, v(Te.value.windowSize), 1),
                  a("span", null, v(S.value ? "窗口尺寸" : "window size"), 1)
                ]),
                a("div", null, [
                  a("strong", null, v(Te.value.selectedScene), 1),
                  a("span", null, v(S.value ? "场景" : "scene"), 1)
                ])
              ]),
              a("div", Xc, [
                a("label", Qc, [
                  a("span", null, [
                    a("strong", null, v(S.value ? "表情映射" : "Expressions"), 1),
                    a("small", null, v(S.value ? "跟随角色输出驱动表情" : "Drive facial expressions from output"), 1)
                  ]),
                  a("input", {
                    checked: Te.value.expressionsEnabled,
                    type: "checkbox",
                    onChange: w[14] || (w[14] = (m) => Me("enabledExpressions", m))
                  }, null, 40, Zc)
                ]),
                a("label", eu, [
                  a("span", null, [
                    a("strong", null, v(S.value ? "动作映射" : "Motions"), 1),
                    a("small", null, v(S.value ? "启用动作集合" : "Enable motion set"), 1)
                  ]),
                  a("input", {
                    checked: Te.value.motionsEnabled,
                    type: "checkbox",
                    onChange: w[15] || (w[15] = (m) => Me("enabledMotions", m))
                  }, null, 40, tu)
                ])
              ])
            ])
          ])
        ])
      ])) : G.value === "behavior" ? (N(), D("div", nu, [
        a("section", su, [
          a("div", iu, [
            a("h1", null, v(S.value ? "自主行为配置" : "Autonomous Behavior"), 1),
            a("p", null, v(S.value ? "定义角色在无人操作时的主动行为" : "Define what roles do proactively when unattended."), 1)
          ]),
          a("div", ou, [
            (N(!0), D(le, null, Ae(Xt.value.rules, (m, nt) => (N(), D("article", {
              key: m.id,
              class: "ox-vite-role-behavior-card"
            }, [
              w[31] || (w[31] = a("div", { class: "ox-vite-role-behavior-card__icon" }, [
                a("i", { class: "fa-solid fa-bolt" })
              ], -1)),
              a("div", lu, [
                a("strong", null, v(m.name), 1),
                a("p", null, v(m.description), 1)
              ]),
              a("div", ru, [
                a("span", null, v(m.frequency), 1),
                Xt.value.hasRealData ? (N(), D("input", {
                  key: 0,
                  checked: m.enabled,
                  type: "checkbox",
                  onChange: (mt) => Ke(nt)
                }, null, 40, au)) : (N(), D("span", cu, v(m.enabled ? S.value ? "已启用" : "Enabled" : S.value ? "未启用" : "Disabled"), 1))
              ])
            ]))), 128))
          ]),
          a("button", {
            type: "button",
            class: "ox-vite-role-primary-btn",
            onClick: lt
          }, [
            w[32] || (w[32] = a("i", { class: "fa-solid fa-plus" }, null, -1)),
            a("span", null, v(S.value ? "添加行为规则" : "Add behavior rule"), 1)
          ])
        ])
      ])) : (N(), D("div", uu, [
        a("section", fu, [
          a("div", du, [
            a("h1", null, v(S.value ? "桌面视觉" : "Desktop Vision"), 1),
            a("p", null, v(S.value ? "让角色能够感知和理解桌面内容" : "Let roles perceive and understand what is on the desktop."), 1)
          ]),
          a("h2", null, v(S.value ? "屏幕捕获设置" : "Screen Capture"), 1),
          a("div", pu, [
            a("label", hu, [
              a("span", null, [
                a("strong", null, v(S.value ? "启用桌面视觉" : "Enable desktop vision"), 1),
                a("small", null, v(S.value ? "开启后角色可以感知屏幕内容" : "Roles can inspect what is on screen"), 1)
              ]),
              a("input", {
                checked: Re.value.desktopVision,
                type: "checkbox",
                onChange: w[16] || (w[16] = (m) => rt("desktopVision", m))
              }, null, 40, gu)
            ]),
            a("label", vu, [
              a("span", null, v(S.value ? "截图频率" : "Capture frequency"), 1),
              a("input", {
                value: Re.value.captureFrequency,
                type: "text",
                readonly: ""
              }, null, 8, mu)
            ]),
            a("label", _u, [
              a("span", null, v(S.value ? "识别区域" : "Capture scope"), 1),
              a("input", {
                value: Re.value.captureScope,
                type: "text",
                readonly: ""
              }, null, 8, yu)
            ])
          ]),
          a("h2", null, v(S.value ? "视觉模型绑定" : "Vision Model"), 1),
          a("div", bu, [
            a("label", xu, [
              a("span", null, v(S.value ? "视觉供应商" : "Vision provider"), 1),
              a("select", {
                value: Re.value.selectedProvider,
                onChange: Et
              }, [
                a("option", wu, v(S.value ? "请选择视觉供应商" : "Select a provider"), 1),
                (N(!0), D(le, null, Ae(Re.value.providerOptions, (m) => (N(), D("option", {
                  key: m.value,
                  value: m.value
                }, v(m.label), 9, Mu))), 128))
              ], 40, Su)
            ]),
            a("label", Cu, [
              a("span", null, v(S.value ? "当前视觉模型" : "Current vision model"), 1),
              a("input", {
                value: Re.value.modelLabel,
                type: "text",
                readonly: ""
              }, null, 8, Tu)
            ])
          ]),
          a("h2", null, v(S.value ? "唤醒词与隐私" : "Wake Words and Privacy"), 1),
          a("div", Ru, [
            a("label", Au, [
              a("span", null, [
                a("strong", null, v(S.value ? "启用视觉唤醒词" : "Enable vision wake words"), 1),
                a("small", null, v(S.value ? "检测到关键词时读取桌面内容" : "Read desktop content after wake word matches"), 1)
              ]),
              a("input", {
                checked: Re.value.enableWakeWord,
                type: "checkbox",
                onChange: w[17] || (w[17] = (m) => rt("enableWakeWord", m))
              }, null, 40, Eu)
            ]),
            a("label", Pu, [
              a("span", null, v(S.value ? "唤醒词" : "Wake words"), 1),
              a("textarea", {
                value: Re.value.wakeWord,
                rows: "4",
                onInput: w[18] || (w[18] = (m) => vt("wakeWord", m))
              }, null, 40, Iu)
            ]),
            a("div", Ou, [
              a("span", null, v(S.value ? "排除应用列表" : "Excluded apps"), 1),
              a("div", ku, [
                (N(!0), D(le, null, Ae(Re.value.excludeApps, (m) => (N(), D("span", {
                  key: m,
                  class: "ox-vite-role-chip"
                }, v(m), 1))), 128))
              ])
            ])
          ])
        ])
      ]))
    ]));
  }
};
function Gn() {
  const e = document.getElementById("openxnet-vite-role-root");
  !e || e.dataset.viteMounted === "true" || (Ar(Fu).mount(e), e.dataset.viteMounted = "true");
}
document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", Gn, { once: !0 }) : Gn();
window.addEventListener("openxnet-vite-role-remount", Gn);
