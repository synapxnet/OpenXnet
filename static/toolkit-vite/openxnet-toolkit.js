// @__NO_SIDE_EFFECTS__
function Hn(e) {
  const t = /* @__PURE__ */ Object.create(null);
  for (const n of e.split(",")) t[n] = 1;
  return (n) => n in t;
}
const z = {}, ht = [], He = () => {
}, Us = () => !1, nn = (e) => e.charCodeAt(0) === 111 && e.charCodeAt(1) === 110 && // uppercase letter
(e.charCodeAt(2) > 122 || e.charCodeAt(2) < 97), sn = (e) => e.startsWith("onUpdate:"), ue = Object.assign, Fn = (e, t) => {
  const n = e.indexOf(t);
  n > -1 && e.splice(n, 1);
}, to = Object.prototype.hasOwnProperty, V = (e, t) => to.call(e, t), F = Array.isArray, gt = (e) => Nt(e) === "[object Map]", Ks = (e) => Nt(e) === "[object Set]", us = (e) => Nt(e) === "[object Date]", j = (e) => typeof e == "function", se = (e) => typeof e == "string", Be = (e) => typeof e == "symbol", G = (e) => e !== null && typeof e == "object", qs = (e) => (G(e) || j(e)) && j(e.then) && j(e.catch), Ws = Object.prototype.toString, Nt = (e) => Ws.call(e), no = (e) => Nt(e).slice(8, -1), Vs = (e) => Nt(e) === "[object Object]", Bn = (e) => se(e) && e !== "NaN" && e[0] !== "-" && "" + parseInt(e, 10) === e, At = /* @__PURE__ */ Hn(
  // the leading comma is intentional so empty string "" is also included
  ",key,ref,ref_for,ref_key,onVnodeBeforeMount,onVnodeMounted,onVnodeBeforeUpdate,onVnodeUpdated,onVnodeBeforeUnmount,onVnodeUnmounted"
), on = (e) => {
  const t = /* @__PURE__ */ Object.create(null);
  return ((n) => t[n] || (t[n] = e(n)));
}, so = /-\w/g, Ce = on(
  (e) => e.replace(so, (t) => t.slice(1).toUpperCase())
), io = /\B([A-Z])/g, at = on(
  (e) => e.replace(io, "-$1").toLowerCase()
), Gs = on((e) => e.charAt(0).toUpperCase() + e.slice(1)), pn = on(
  (e) => e ? `on${Gs(e)}` : ""
), Re = (e, t) => !Object.is(e, t), hn = (e, ...t) => {
  for (let n = 0; n < e.length; n++)
    e[n](...t);
}, Qs = (e, t, n, s = !1) => {
  Object.defineProperty(e, t, {
    configurable: !0,
    enumerable: !1,
    writable: s,
    value: n
  });
}, oo = (e) => {
  const t = parseFloat(e);
  return isNaN(t) ? e : t;
};
let fs;
const ln = () => fs || (fs = typeof globalThis < "u" ? globalThis : typeof self < "u" ? self : typeof window < "u" ? window : typeof globalThis < "u" ? globalThis : {});
function Nn(e) {
  if (F(e)) {
    const t = {};
    for (let n = 0; n < e.length; n++) {
      const s = e[n], i = se(s) ? co(s) : Nn(s);
      if (i)
        for (const o in i)
          t[o] = i[o];
    }
    return t;
  } else if (se(e) || G(e))
    return e;
}
const lo = /;(?![^(]*\))/g, ro = /:([^]+)/, ao = /\/\*[^]*?\*\//g;
function co(e) {
  const t = {};
  return e.replace(ao, "").split(lo).forEach((n) => {
    if (n) {
      const s = n.split(ro);
      s.length > 1 && (t[s[0].trim()] = s[1].trim());
    }
  }), t;
}
function oe(e) {
  let t = "";
  if (se(e))
    t = e;
  else if (F(e))
    for (let n = 0; n < e.length; n++) {
      const s = oe(e[n]);
      s && (t += s + " ");
    }
  else if (G(e))
    for (const n in e)
      e[n] && (t += n + " ");
  return t.trim();
}
const uo = "itemscope,allowfullscreen,formnovalidate,ismap,nomodule,novalidate,readonly", fo = /* @__PURE__ */ Hn(uo);
function Xs(e) {
  return !!e || e === "";
}
function po(e, t) {
  if (e.length !== t.length) return !1;
  let n = !0;
  for (let s = 0; n && s < e.length; s++)
    n = jn(e[s], t[s]);
  return n;
}
function jn(e, t) {
  if (e === t) return !0;
  let n = us(e), s = us(t);
  if (n || s)
    return n && s ? e.getTime() === t.getTime() : !1;
  if (n = Be(e), s = Be(t), n || s)
    return e === t;
  if (n = F(e), s = F(t), n || s)
    return n && s ? po(e, t) : !1;
  if (n = G(e), s = G(t), n || s) {
    if (!n || !s)
      return !1;
    const i = Object.keys(e).length, o = Object.keys(t).length;
    if (i !== o)
      return !1;
    for (const l in e) {
      const r = e.hasOwnProperty(l), c = t.hasOwnProperty(l);
      if (r && !c || !r && c || !jn(e[l], t[l]))
        return !1;
    }
  }
  return String(e) === String(t);
}
const Zs = (e) => !!(e && e.__v_isRef === !0), E = (e) => se(e) ? e : e == null ? "" : F(e) || G(e) && (e.toString === Ws || !j(e.toString)) ? Zs(e) ? E(e.value) : JSON.stringify(e, Js, 2) : String(e), Js = (e, t) => Zs(t) ? Js(e, t.value) : gt(t) ? {
  [`Map(${t.size})`]: [...t.entries()].reduce(
    (n, [s, i], o) => (n[gn(s, o) + " =>"] = i, n),
    {}
  )
} : Ks(t) ? {
  [`Set(${t.size})`]: [...t.values()].map((n) => gn(n))
} : Be(t) ? gn(t) : G(t) && !F(t) && !Vs(t) ? String(t) : t, gn = (e, t = "") => {
  var n;
  return (
    // Symbol.description in es2019+ so we need to cast here to pass
    // the lib: es2016 check
    Be(e) ? `Symbol(${(n = e.description) != null ? n : t})` : e
  );
};
let re;
class ho {
  // TODO isolatedDeclarations "__v_skip"
  constructor(t = !1) {
    this.detached = t, this._active = !0, this._on = 0, this.effects = [], this.cleanups = [], this._isPaused = !1, this._warnOnRun = !0, this.__v_skip = !0, !t && re && (re.active ? (this.parent = re, this.index = (re.scopes || (re.scopes = [])).push(
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
      const n = re;
      try {
        return re = this, t();
      } finally {
        re = n;
      }
    }
  }
  /**
   * This should only be called on non-detached scopes
   * @internal
   */
  on() {
    ++this._on === 1 && (this.prevScope = re, re = this);
  }
  /**
   * This should only be called on non-detached scopes
   * @internal
   */
  off() {
    if (this._on > 0 && --this._on === 0) {
      if (re === this)
        re = this.prevScope;
      else {
        let t = re;
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
function go() {
  return re;
}
let Y;
const _n = /* @__PURE__ */ new WeakSet();
class Ys {
  constructor(t) {
    this.fn = t, this.deps = void 0, this.depsTail = void 0, this.flags = 5, this.next = void 0, this.cleanup = void 0, this.scheduler = void 0, re && (re.active ? re.effects.push(this) : this.flags &= -2);
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
    this.flags & 2 && !(this.flags & 32) || this.flags & 8 || ei(this);
  }
  run() {
    if (!(this.flags & 1))
      return this.fn();
    this.flags |= 2, ds(this), ti(this);
    const t = Y, n = we;
    Y = this, we = !0;
    try {
      return this.fn();
    } finally {
      ni(this), Y = t, we = n, this.flags &= -3;
    }
  }
  stop() {
    if (this.flags & 1) {
      for (let t = this.deps; t; t = t.nextDep)
        Kn(t);
      this.deps = this.depsTail = void 0, ds(this), this.onStop && this.onStop(), this.flags &= -2;
    }
  }
  trigger() {
    this.flags & 64 ? _n.add(this) : this.scheduler ? this.scheduler() : this.runIfDirty();
  }
  /**
   * @internal
   */
  runIfDirty() {
    wn(this) && this.run();
  }
  get dirty() {
    return wn(this);
  }
}
let zs = 0, Pt, Et;
function ei(e, t = !1) {
  if (e.flags |= 8, t) {
    e.next = Et, Et = e;
    return;
  }
  e.next = Pt, Pt = e;
}
function $n() {
  zs++;
}
function Un() {
  if (--zs > 0)
    return;
  if (Et) {
    let t = Et;
    for (Et = void 0; t; ) {
      const n = t.next;
      t.next = void 0, t.flags &= -9, t = n;
    }
  }
  let e;
  for (; Pt; ) {
    let t = Pt;
    for (Pt = void 0; t; ) {
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
function ti(e) {
  for (let t = e.deps; t; t = t.nextDep)
    t.version = -1, t.prevActiveLink = t.dep.activeLink, t.dep.activeLink = t;
}
function ni(e) {
  let t, n = e.depsTail, s = n;
  for (; s; ) {
    const i = s.prevDep;
    s.version === -1 ? (s === n && (n = i), Kn(s), _o(s)) : t = s, s.dep.activeLink = s.prevActiveLink, s.prevActiveLink = void 0, s = i;
  }
  e.deps = t, e.depsTail = n;
}
function wn(e) {
  for (let t = e.deps; t; t = t.nextDep)
    if (t.dep.version !== t.version || t.dep.computed && (si(t.dep.computed) || t.dep.version !== t.version))
      return !0;
  return !!e._dirty;
}
function si(e) {
  if (e.flags & 4 && !(e.flags & 16) || (e.flags &= -17, e.globalVersion === Rt) || (e.globalVersion = Rt, !e.isSSR && e.flags & 128 && (!e.deps && !e._dirty || !wn(e))))
    return;
  e.flags |= 2;
  const t = e.dep, n = Y, s = we;
  Y = e, we = !0;
  try {
    ti(e);
    const i = e.fn(e._value);
    (t.version === 0 || Re(i, e._value)) && (e.flags |= 128, e._value = i, t.version++);
  } catch (i) {
    throw t.version++, i;
  } finally {
    Y = n, we = s, ni(e), e.flags &= -3;
  }
}
function Kn(e, t = !1) {
  const { dep: n, prevSub: s, nextSub: i } = e;
  if (s && (s.nextSub = i, e.prevSub = void 0), i && (i.prevSub = s, e.nextSub = void 0), n.subs === e && (n.subs = s, !s && n.computed)) {
    n.computed.flags &= -5;
    for (let o = n.computed.deps; o; o = o.nextDep)
      Kn(o, !0);
  }
  !t && !--n.sc && n.map && n.map.delete(n.key);
}
function _o(e) {
  const { prevDep: t, nextDep: n } = e;
  t && (t.nextDep = n, e.prevDep = void 0), n && (n.prevDep = t, e.nextDep = void 0);
}
let we = !0;
const ii = [];
function Ve() {
  ii.push(we), we = !1;
}
function Ge() {
  const e = ii.pop();
  we = e === void 0 ? !0 : e;
}
function ds(e) {
  const { cleanup: t } = e;
  if (e.cleanup = void 0, t) {
    const n = Y;
    Y = void 0;
    try {
      t();
    } finally {
      Y = n;
    }
  }
}
let Rt = 0;
class vo {
  constructor(t, n) {
    this.sub = t, this.dep = n, this.version = n.version, this.nextDep = this.prevDep = this.nextSub = this.prevSub = this.prevActiveLink = void 0;
  }
}
class qn {
  // TODO isolatedDeclarations "__v_skip"
  constructor(t) {
    this.computed = t, this.version = 0, this.activeLink = void 0, this.subs = void 0, this.map = void 0, this.key = void 0, this.sc = 0, this.__v_skip = !0;
  }
  track(t) {
    if (!Y || !we || Y === this.computed)
      return;
    let n = this.activeLink;
    if (n === void 0 || n.sub !== Y)
      n = this.activeLink = new vo(Y, this), Y.deps ? (n.prevDep = Y.depsTail, Y.depsTail.nextDep = n, Y.depsTail = n) : Y.deps = Y.depsTail = n, oi(n);
    else if (n.version === -1 && (n.version = this.version, n.nextDep)) {
      const s = n.nextDep;
      s.prevDep = n.prevDep, n.prevDep && (n.prevDep.nextDep = s), n.prevDep = Y.depsTail, n.nextDep = void 0, Y.depsTail.nextDep = n, Y.depsTail = n, Y.deps === n && (Y.deps = s);
    }
    return n;
  }
  trigger(t) {
    this.version++, Rt++, this.notify(t);
  }
  notify(t) {
    $n();
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
      for (let s = t.deps; s; s = s.nextDep)
        oi(s);
    }
    const n = e.dep.subs;
    n !== e && (e.prevSub = n, n && (n.nextSub = e)), e.dep.subs = e;
  }
}
const kn = /* @__PURE__ */ new WeakMap(), lt = /* @__PURE__ */ Symbol(
  ""
), Tn = /* @__PURE__ */ Symbol(
  ""
), Dt = /* @__PURE__ */ Symbol(
  ""
);
function ae(e, t, n) {
  if (we && Y) {
    let s = kn.get(e);
    s || kn.set(e, s = /* @__PURE__ */ new Map());
    let i = s.get(n);
    i || (s.set(n, i = new qn()), i.map = s, i.key = n), i.track();
  }
}
function We(e, t, n, s, i, o) {
  const l = kn.get(e);
  if (!l) {
    Rt++;
    return;
  }
  const r = (c) => {
    c && c.trigger();
  };
  if ($n(), t === "clear")
    l.forEach(r);
  else {
    const c = F(e), p = c && Bn(n);
    if (c && n === "length") {
      const d = Number(s);
      l.forEach((_, S) => {
        (S === "length" || S === Dt || !Be(S) && S >= d) && r(_);
      });
    } else
      switch ((n !== void 0 || l.has(void 0)) && r(l.get(n)), p && r(l.get(Dt)), t) {
        case "add":
          c ? p && r(l.get("length")) : (r(l.get(lt)), gt(e) && r(l.get(Tn)));
          break;
        case "delete":
          c || (r(l.get(lt)), gt(e) && r(l.get(Tn)));
          break;
        case "set":
          gt(e) && r(l.get(lt));
          break;
      }
  }
  Un();
}
function ft(e) {
  const t = /* @__PURE__ */ W(e);
  return t === e ? t : (ae(t, "iterate", Dt), /* @__PURE__ */ ye(e) ? t : t.map(ke));
}
function rn(e) {
  return ae(e = /* @__PURE__ */ W(e), "iterate", Dt), e;
}
function Oe(e, t) {
  return /* @__PURE__ */ Qe(e) ? mt(/* @__PURE__ */ rt(e) ? ke(t) : t) : ke(t);
}
const mo = {
  __proto__: null,
  [Symbol.iterator]() {
    return vn(this, Symbol.iterator, (e) => Oe(this, e));
  },
  concat(...e) {
    return ft(this).concat(
      ...e.map((t) => F(t) ? ft(t) : t)
    );
  },
  entries() {
    return vn(this, "entries", (e) => (e[1] = Oe(this, e[1]), e));
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
      (n) => n.map((s) => Oe(this, s)),
      arguments
    );
  },
  find(e, t) {
    return je(
      this,
      "find",
      e,
      t,
      (n) => Oe(this, n),
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
      (n) => Oe(this, n),
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
    return mn(this, "includes", e);
  },
  indexOf(...e) {
    return mn(this, "indexOf", e);
  },
  join(e) {
    return ft(this).join(e);
  },
  // keys() iterator only reads `length`, no optimization required
  lastIndexOf(...e) {
    return mn(this, "lastIndexOf", e);
  },
  map(e, t) {
    return je(this, "map", e, t, void 0, arguments);
  },
  pop() {
    return Ct(this, "pop");
  },
  push(...e) {
    return Ct(this, "push", e);
  },
  reduce(e, ...t) {
    return ps(this, "reduce", e, t);
  },
  reduceRight(e, ...t) {
    return ps(this, "reduceRight", e, t);
  },
  shift() {
    return Ct(this, "shift");
  },
  // slice could use ARRAY_ITERATE but also seems to beg for range tracking
  some(e, t) {
    return je(this, "some", e, t, void 0, arguments);
  },
  splice(...e) {
    return Ct(this, "splice", e);
  },
  toReversed() {
    return ft(this).toReversed();
  },
  toSorted(e) {
    return ft(this).toSorted(e);
  },
  toSpliced(...e) {
    return ft(this).toSpliced(...e);
  },
  unshift(...e) {
    return Ct(this, "unshift", e);
  },
  values() {
    return vn(this, "values", (e) => Oe(this, e));
  }
};
function vn(e, t, n) {
  const s = rn(e), i = s[t]();
  return s !== e && !/* @__PURE__ */ ye(e) && (i._next = i.next, i.next = () => {
    const o = i._next();
    return o.done || (o.value = n(o.value)), o;
  }), i;
}
const bo = Array.prototype;
function je(e, t, n, s, i, o) {
  const l = rn(e), r = l !== e && !/* @__PURE__ */ ye(e), c = l[t];
  if (c !== bo[t]) {
    const _ = c.apply(e, o);
    return r ? ke(_) : _;
  }
  let p = n;
  l !== e && (r ? p = function(_, S) {
    return n.call(this, Oe(e, _), S, e);
  } : n.length > 2 && (p = function(_, S) {
    return n.call(this, _, S, e);
  }));
  const d = c.call(l, p, s);
  return r && i ? i(d) : d;
}
function ps(e, t, n, s) {
  const i = rn(e), o = i !== e && !/* @__PURE__ */ ye(e);
  let l = n, r = !1;
  i !== e && (o ? (r = s.length === 0, l = function(p, d, _) {
    return r && (r = !1, p = Oe(e, p)), n.call(this, p, Oe(e, d), _, e);
  }) : n.length > 3 && (l = function(p, d, _) {
    return n.call(this, p, d, _, e);
  }));
  const c = i[t](l, ...s);
  return r ? Oe(e, c) : c;
}
function mn(e, t, n) {
  const s = /* @__PURE__ */ W(e);
  ae(s, "iterate", Dt);
  const i = s[t](...n);
  return (i === -1 || i === !1) && /* @__PURE__ */ Qn(n[0]) ? (n[0] = /* @__PURE__ */ W(n[0]), s[t](...n)) : i;
}
function Ct(e, t, n = []) {
  Ve(), $n();
  const s = (/* @__PURE__ */ W(e))[t].apply(e, n);
  return Un(), Ge(), s;
}
const yo = /* @__PURE__ */ Hn("__proto__,__v_isRef,__isVue"), li = new Set(
  /* @__PURE__ */ Object.getOwnPropertyNames(Symbol).filter((e) => e !== "arguments" && e !== "caller").map((e) => Symbol[e]).filter(Be)
);
function xo(e) {
  Be(e) || (e = String(e));
  const t = /* @__PURE__ */ W(this);
  return ae(t, "has", e), t.hasOwnProperty(e);
}
class ri {
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
      return s === (i ? o ? Io : fi : o ? ui : ci).get(t) || // receiver is not the reactive proxy, but has the same prototype
      // this means the receiver is a user proxy of the reactive proxy
      Object.getPrototypeOf(t) === Object.getPrototypeOf(s) ? t : void 0;
    const l = F(t);
    if (!i) {
      let c;
      if (l && (c = mo[n]))
        return c;
      if (n === "hasOwnProperty")
        return xo;
    }
    const r = Reflect.get(
      t,
      n,
      // if this is a proxy wrapping a ref, return methods using the raw ref
      // as receiver so that we don't have to call `toRaw` on the ref in all
      // its class methods
      /* @__PURE__ */ ce(t) ? t : s
    );
    if ((Be(n) ? li.has(n) : yo(n)) || (i || ae(t, "get", n), o))
      return r;
    if (/* @__PURE__ */ ce(r)) {
      const c = l && Bn(n) ? r : r.value;
      return i && G(c) ? /* @__PURE__ */ Pn(c) : c;
    }
    return G(r) ? i ? /* @__PURE__ */ Pn(r) : /* @__PURE__ */ Vn(r) : r;
  }
}
class ai extends ri {
  constructor(t = !1) {
    super(!1, t);
  }
  set(t, n, s, i) {
    let o = t[n];
    const l = F(t) && Bn(n);
    if (!this._isShallow) {
      const p = /* @__PURE__ */ Qe(o);
      if (!/* @__PURE__ */ ye(s) && !/* @__PURE__ */ Qe(s) && (o = /* @__PURE__ */ W(o), s = /* @__PURE__ */ W(s)), !l && /* @__PURE__ */ ce(o) && !/* @__PURE__ */ ce(s))
        return p || (o.value = s), !0;
    }
    const r = l ? Number(n) < t.length : V(t, n), c = Reflect.set(
      t,
      n,
      s,
      /* @__PURE__ */ ce(t) ? t : i
    );
    return t === /* @__PURE__ */ W(i) && (r ? Re(s, o) && We(t, "set", n, s) : We(t, "add", n, s)), c;
  }
  deleteProperty(t, n) {
    const s = V(t, n);
    t[n];
    const i = Reflect.deleteProperty(t, n);
    return i && s && We(t, "delete", n, void 0), i;
  }
  has(t, n) {
    const s = Reflect.has(t, n);
    return (!Be(n) || !li.has(n)) && ae(t, "has", n), s;
  }
  ownKeys(t) {
    return ae(
      t,
      "iterate",
      F(t) ? "length" : lt
    ), Reflect.ownKeys(t);
  }
}
class So extends ri {
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
const Co = /* @__PURE__ */ new ai(), wo = /* @__PURE__ */ new So(), ko = /* @__PURE__ */ new ai(!0);
const An = (e) => e, qt = (e) => Reflect.getPrototypeOf(e);
function To(e, t, n) {
  return function(...s) {
    const i = this.__v_raw, o = /* @__PURE__ */ W(i), l = gt(o), r = e === "entries" || e === Symbol.iterator && l, c = e === "keys" && l, p = i[e](...s), d = n ? An : t ? mt : ke;
    return !t && ae(
      o,
      "iterate",
      c ? Tn : lt
    ), ue(
      // inheriting all iterator properties
      Object.create(p),
      {
        // iterator protocol
        next() {
          const { value: _, done: S } = p.next();
          return S ? { value: _, done: S } : {
            value: r ? [d(_[0]), d(_[1])] : d(_),
            done: S
          };
        }
      }
    );
  };
}
function Wt(e) {
  return function(...t) {
    return e === "delete" ? !1 : e === "clear" ? void 0 : this;
  };
}
function Ao(e, t) {
  const n = {
    get(i) {
      const o = this.__v_raw, l = /* @__PURE__ */ W(o), r = /* @__PURE__ */ W(i);
      e || (Re(i, r) && ae(l, "get", i), ae(l, "get", r));
      const { has: c } = qt(l), p = t ? An : e ? mt : ke;
      if (c.call(l, i))
        return p(o.get(i));
      if (c.call(l, r))
        return p(o.get(r));
      o !== l && o.get(i);
    },
    get size() {
      const i = this.__v_raw;
      return !e && ae(/* @__PURE__ */ W(i), "iterate", lt), i.size;
    },
    has(i) {
      const o = this.__v_raw, l = /* @__PURE__ */ W(o), r = /* @__PURE__ */ W(i);
      return e || (Re(i, r) && ae(l, "has", i), ae(l, "has", r)), i === r ? o.has(i) : o.has(i) || o.has(r);
    },
    forEach(i, o) {
      const l = this, r = l.__v_raw, c = /* @__PURE__ */ W(r), p = t ? An : e ? mt : ke;
      return !e && ae(c, "iterate", lt), r.forEach((d, _) => i.call(o, p(d), p(_), l));
    }
  };
  return ue(
    n,
    e ? {
      add: Wt("add"),
      set: Wt("set"),
      delete: Wt("delete"),
      clear: Wt("clear")
    } : {
      add(i) {
        const o = /* @__PURE__ */ W(this), l = qt(o), r = /* @__PURE__ */ W(i), c = !t && !/* @__PURE__ */ ye(i) && !/* @__PURE__ */ Qe(i) ? r : i;
        return l.has.call(o, c) || Re(i, c) && l.has.call(o, i) || Re(r, c) && l.has.call(o, r) || (o.add(c), We(o, "add", c, c)), this;
      },
      set(i, o) {
        !t && !/* @__PURE__ */ ye(o) && !/* @__PURE__ */ Qe(o) && (o = /* @__PURE__ */ W(o));
        const l = /* @__PURE__ */ W(this), { has: r, get: c } = qt(l);
        let p = r.call(l, i);
        p || (i = /* @__PURE__ */ W(i), p = r.call(l, i));
        const d = c.call(l, i);
        return l.set(i, o), p ? Re(o, d) && We(l, "set", i, o) : We(l, "add", i, o), this;
      },
      delete(i) {
        const o = /* @__PURE__ */ W(this), { has: l, get: r } = qt(o);
        let c = l.call(o, i);
        c || (i = /* @__PURE__ */ W(i), c = l.call(o, i)), r && r.call(o, i);
        const p = o.delete(i);
        return c && We(o, "delete", i, void 0), p;
      },
      clear() {
        const i = /* @__PURE__ */ W(this), o = i.size !== 0, l = i.clear();
        return o && We(
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
    n[i] = To(i, e, t);
  }), n;
}
function Wn(e, t) {
  const n = Ao(e, t);
  return (s, i, o) => i === "__v_isReactive" ? !e : i === "__v_isReadonly" ? e : i === "__v_raw" ? s : Reflect.get(
    V(n, i) && i in s ? n : s,
    i,
    o
  );
}
const Po = {
  get: /* @__PURE__ */ Wn(!1, !1)
}, Eo = {
  get: /* @__PURE__ */ Wn(!1, !0)
}, Mo = {
  get: /* @__PURE__ */ Wn(!0, !1)
};
const ci = /* @__PURE__ */ new WeakMap(), ui = /* @__PURE__ */ new WeakMap(), fi = /* @__PURE__ */ new WeakMap(), Io = /* @__PURE__ */ new WeakMap();
function Oo(e) {
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
function Lo(e) {
  return e.__v_skip || !Object.isExtensible(e) ? 0 : Oo(no(e));
}
// @__NO_SIDE_EFFECTS__
function Vn(e) {
  return /* @__PURE__ */ Qe(e) ? e : Gn(
    e,
    !1,
    Co,
    Po,
    ci
  );
}
// @__NO_SIDE_EFFECTS__
function Ro(e) {
  return Gn(
    e,
    !1,
    ko,
    Eo,
    ui
  );
}
// @__NO_SIDE_EFFECTS__
function Pn(e) {
  return Gn(
    e,
    !0,
    wo,
    Mo,
    fi
  );
}
function Gn(e, t, n, s, i) {
  if (!G(e) || e.__v_raw && !(t && e.__v_isReactive))
    return e;
  const o = Lo(e);
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
function rt(e) {
  return /* @__PURE__ */ Qe(e) ? /* @__PURE__ */ rt(e.__v_raw) : !!(e && e.__v_isReactive);
}
// @__NO_SIDE_EFFECTS__
function Qe(e) {
  return !!(e && e.__v_isReadonly);
}
// @__NO_SIDE_EFFECTS__
function ye(e) {
  return !!(e && e.__v_isShallow);
}
// @__NO_SIDE_EFFECTS__
function Qn(e) {
  return e ? !!e.__v_raw : !1;
}
// @__NO_SIDE_EFFECTS__
function W(e) {
  const t = e && e.__v_raw;
  return t ? /* @__PURE__ */ W(t) : e;
}
function Do(e) {
  return !V(e, "__v_skip") && Object.isExtensible(e) && Qs(e, "__v_skip", !0), e;
}
const ke = (e) => G(e) ? /* @__PURE__ */ Vn(e) : e, mt = (e) => G(e) ? /* @__PURE__ */ Pn(e) : e;
// @__NO_SIDE_EFFECTS__
function ce(e) {
  return e ? e.__v_isRef === !0 : !1;
}
// @__NO_SIDE_EFFECTS__
function Ho(e) {
  return Fo(e, !1);
}
function Fo(e, t) {
  return /* @__PURE__ */ ce(e) ? e : new Bo(e, t);
}
class Bo {
  constructor(t, n) {
    this.dep = new qn(), this.__v_isRef = !0, this.__v_isShallow = !1, this._rawValue = n ? t : /* @__PURE__ */ W(t), this._value = n ? t : ke(t), this.__v_isShallow = n;
  }
  get value() {
    return this.dep.track(), this._value;
  }
  set value(t) {
    const n = this._rawValue, s = this.__v_isShallow || /* @__PURE__ */ ye(t) || /* @__PURE__ */ Qe(t);
    t = s ? t : /* @__PURE__ */ W(t), Re(t, n) && (this._rawValue = t, this._value = s ? t : ke(t), this.dep.trigger());
  }
}
function No(e) {
  return /* @__PURE__ */ ce(e) ? e.value : e;
}
const jo = {
  get: (e, t, n) => t === "__v_raw" ? e : No(Reflect.get(e, t, n)),
  set: (e, t, n, s) => {
    const i = e[t];
    return /* @__PURE__ */ ce(i) && !/* @__PURE__ */ ce(n) ? (i.value = n, !0) : Reflect.set(e, t, n, s);
  }
};
function di(e) {
  return /* @__PURE__ */ rt(e) ? e : new Proxy(e, jo);
}
class $o {
  constructor(t, n, s) {
    this.fn = t, this.setter = n, this._value = void 0, this.dep = new qn(this), this.__v_isRef = !0, this.deps = void 0, this.depsTail = void 0, this.flags = 16, this.globalVersion = Rt - 1, this.next = void 0, this.effect = this, this.__v_isReadonly = !n, this.isSSR = s;
  }
  /**
   * @internal
   */
  notify() {
    if (this.flags |= 16, !(this.flags & 8) && // avoid infinite self recursion
    Y !== this)
      return ei(this, !0), !0;
  }
  get value() {
    const t = this.dep.track();
    return si(this), t && (t.version = this.dep.version), this._value;
  }
  set value(t) {
    this.setter && this.setter(t);
  }
}
// @__NO_SIDE_EFFECTS__
function Uo(e, t, n = !1) {
  let s, i;
  return j(e) ? s = e : (s = e.get, i = e.set), new $o(s, i, n);
}
const Vt = {}, Zt = /* @__PURE__ */ new WeakMap();
let ot;
function Ko(e, t = !1, n = ot) {
  if (n) {
    let s = Zt.get(n);
    s || Zt.set(n, s = []), s.push(e);
  }
}
function qo(e, t, n = z) {
  const { immediate: s, deep: i, once: o, scheduler: l, augmentJob: r, call: c } = n, p = (P) => i ? P : /* @__PURE__ */ ye(P) || i === !1 || i === 0 ? Ye(P, 1) : Ye(P);
  let d, _, S, I, q = !1, H = !1;
  if (/* @__PURE__ */ ce(e) ? (_ = () => e.value, q = /* @__PURE__ */ ye(e)) : /* @__PURE__ */ rt(e) ? (_ = () => p(e), q = !0) : F(e) ? (H = !0, q = e.some((P) => /* @__PURE__ */ rt(P) || /* @__PURE__ */ ye(P)), _ = () => e.map((P) => {
    if (/* @__PURE__ */ ce(P))
      return P.value;
    if (/* @__PURE__ */ rt(P))
      return p(P);
    if (j(P))
      return c ? c(P, 2) : P();
  })) : j(e) ? t ? _ = c ? () => c(e, 2) : e : _ = () => {
    if (S) {
      Ve();
      try {
        S();
      } finally {
        Ge();
      }
    }
    const P = ot;
    ot = d;
    try {
      return c ? c(e, 3, [I]) : e(I);
    } finally {
      ot = P;
    }
  } : _ = He, t && i) {
    const P = _, M = i === !0 ? 1 / 0 : i;
    _ = () => Ye(P(), M);
  }
  const T = go(), X = () => {
    d.stop(), T && T.active && Fn(T.effects, d);
  };
  if (o && t) {
    const P = t;
    t = (...M) => {
      P(...M), X();
    };
  }
  let $ = H ? new Array(e.length).fill(Vt) : Vt;
  const O = (P) => {
    if (!(!(d.flags & 1) || !d.dirty && !P))
      if (t) {
        const M = d.run();
        if (i || q || (H ? M.some((xe, be) => Re(xe, $[be])) : Re(M, $))) {
          S && S();
          const xe = ot;
          ot = d;
          try {
            const be = [
              M,
              // pass undefined as the old value when it's changed for the first time
              $ === Vt ? void 0 : H && $[0] === Vt ? [] : $,
              I
            ];
            $ = M, c ? c(t, 3, be) : (
              // @ts-expect-error
              t(...be)
            );
          } finally {
            ot = xe;
          }
        }
      } else
        d.run();
  };
  return r && r(O), d = new Ys(_), d.scheduler = l ? () => l(O, !1) : O, I = (P) => Ko(P, !1, d), S = d.onStop = () => {
    const P = Zt.get(d);
    if (P) {
      if (c)
        c(P, 4);
      else
        for (const M of P) M();
      Zt.delete(d);
    }
  }, t ? s ? O(!0) : $ = d.run() : l ? l(O.bind(null, !0), !0) : d.run(), X.pause = d.pause.bind(d), X.resume = d.resume.bind(d), X.stop = X, X;
}
function Ye(e, t = 1 / 0, n) {
  if (t <= 0 || !G(e) || e.__v_skip || (n = n || /* @__PURE__ */ new Map(), (n.get(e) || 0) >= t))
    return e;
  if (n.set(e, t), t--, /* @__PURE__ */ ce(e))
    Ye(e.value, t, n);
  else if (F(e))
    for (let s = 0; s < e.length; s++)
      Ye(e[s], t, n);
  else if (Ks(e) || gt(e))
    e.forEach((s) => {
      Ye(s, t, n);
    });
  else if (Vs(e)) {
    for (const s in e)
      Ye(e[s], t, n);
    for (const s of Object.getOwnPropertySymbols(e))
      Object.prototype.propertyIsEnumerable.call(e, s) && Ye(e[s], t, n);
  }
  return e;
}
function jt(e, t, n, s) {
  try {
    return s ? e(...s) : e();
  } catch (i) {
    an(i, t, n);
  }
}
function Ne(e, t, n, s) {
  if (j(e)) {
    const i = jt(e, t, n, s);
    return i && qs(i) && i.catch((o) => {
      an(o, t, n);
    }), i;
  }
  if (F(e)) {
    const i = [];
    for (let o = 0; o < e.length; o++)
      i.push(Ne(e[o], t, n, s));
    return i;
  }
}
function an(e, t, n, s = !0) {
  const i = t ? t.vnode : null, { errorHandler: o, throwUnhandledErrorInProduction: l } = t && t.appContext.config || z;
  if (t) {
    let r = t.parent;
    const c = t.proxy, p = `https://vuejs.org/error-reference/#runtime-${n}`;
    for (; r; ) {
      const d = r.ec;
      if (d) {
        for (let _ = 0; _ < d.length; _++)
          if (d[_](e, c, p) === !1)
            return;
      }
      r = r.parent;
    }
    if (o) {
      Ve(), jt(o, null, 10, [
        e,
        c,
        p
      ]), Ge();
      return;
    }
  }
  Wo(e, n, i, s, l);
}
function Wo(e, t, n, s = !0, i = !1) {
  if (i)
    throw e;
  console.error(e);
}
const de = [];
let Ie = -1;
const _t = [];
let Je = null, pt = 0;
const pi = /* @__PURE__ */ Promise.resolve();
let Jt = null;
function Vo(e) {
  const t = Jt || pi;
  return e ? t.then(this ? e.bind(this) : e) : t;
}
function Go(e) {
  let t = Ie + 1, n = de.length;
  for (; t < n; ) {
    const s = t + n >>> 1, i = de[s], o = Ht(i);
    o < e || o === e && i.flags & 2 ? t = s + 1 : n = s;
  }
  return t;
}
function Xn(e) {
  if (!(e.flags & 1)) {
    const t = Ht(e), n = de[de.length - 1];
    !n || // fast path when the job id is larger than the tail
    !(e.flags & 2) && t >= Ht(n) ? de.push(e) : de.splice(Go(t), 0, e), e.flags |= 1, hi();
  }
}
function hi() {
  Jt || (Jt = pi.then(_i));
}
function Qo(e) {
  F(e) ? _t.push(...e) : Je && e.id === -1 ? Je.splice(pt + 1, 0, e) : e.flags & 1 || (_t.push(e), e.flags |= 1), hi();
}
function hs(e, t, n = Ie + 1) {
  for (; n < de.length; n++) {
    const s = de[n];
    if (s && s.flags & 2) {
      if (e && s.id !== e.uid)
        continue;
      de.splice(n, 1), n--, s.flags & 4 && (s.flags &= -2), s(), s.flags & 4 || (s.flags &= -2);
    }
  }
}
function gi(e) {
  if (_t.length) {
    const t = [...new Set(_t)].sort(
      (n, s) => Ht(n) - Ht(s)
    );
    if (_t.length = 0, Je) {
      Je.push(...t);
      return;
    }
    for (Je = t, pt = 0; pt < Je.length; pt++) {
      const n = Je[pt];
      n.flags & 4 && (n.flags &= -2), n.flags & 8 || n(), n.flags &= -2;
    }
    Je = null, pt = 0;
  }
}
const Ht = (e) => e.id == null ? e.flags & 2 ? -1 : 1 / 0 : e.id;
function _i(e) {
  try {
    for (Ie = 0; Ie < de.length; Ie++) {
      const t = de[Ie];
      t && !(t.flags & 8) && (t.flags & 4 && (t.flags &= -2), jt(
        t,
        t.i,
        t.i ? 15 : 14
      ), t.flags & 4 || (t.flags &= -2));
    }
  } finally {
    for (; Ie < de.length; Ie++) {
      const t = de[Ie];
      t && (t.flags &= -2);
    }
    Ie = -1, de.length = 0, gi(), Jt = null, (de.length || _t.length) && _i();
  }
}
let De = null, vi = null;
function Yt(e) {
  const t = De;
  return De = e, vi = e && e.type.__scopeId || null, t;
}
function Xo(e, t = De, n) {
  if (!t || e._n)
    return e;
  const s = (...i) => {
    s._d && ks(-1);
    const o = Yt(t);
    let l;
    try {
      l = e(...i);
    } finally {
      Yt(o), s._d && ks(1);
    }
    return l;
  };
  return s._n = !0, s._c = !0, s._d = !0, s;
}
function st(e, t, n, s) {
  const i = e.dirs, o = t && t.dirs;
  for (let l = 0; l < i.length; l++) {
    const r = i[l];
    o && (r.oldValue = o[l].value);
    let c = r.dir[s];
    c && (Ve(), Ne(c, n, 8, [
      e.el,
      r,
      e,
      t
    ]), Ge());
  }
}
function Zo(e, t) {
  if (pe) {
    let n = pe.provides;
    const s = pe.parent && pe.parent.provides;
    s === n && (n = pe.provides = Object.create(s)), n[e] = t;
  }
}
function Gt(e, t, n = !1) {
  const s = Xl();
  if (s || vt) {
    let i = vt ? vt._context.provides : s ? s.parent == null || s.ce ? s.vnode.appContext && s.vnode.appContext.provides : s.parent.provides : void 0;
    if (i && e in i)
      return i[e];
    if (arguments.length > 1)
      return n && j(t) ? t.call(s && s.proxy) : t;
  }
}
const Jo = /* @__PURE__ */ Symbol.for("v-scx"), Yo = () => Gt(Jo);
function bn(e, t, n) {
  return mi(e, t, n);
}
function mi(e, t, n = z) {
  const { immediate: s, deep: i, flush: o, once: l } = n, r = ue({}, n), c = t && s || !t && o !== "post";
  let p;
  if (Bt) {
    if (o === "sync") {
      const I = Yo();
      p = I.__watcherHandles || (I.__watcherHandles = []);
    } else if (!c) {
      const I = () => {
      };
      return I.stop = He, I.resume = He, I.pause = He, I;
    }
  }
  const d = pe;
  r.call = (I, q, H) => Ne(I, d, q, H);
  let _ = !1;
  o === "post" ? r.scheduler = (I) => {
    he(I, d && d.suspense);
  } : o !== "sync" && (_ = !0, r.scheduler = (I, q) => {
    q ? I() : Xn(I);
  }), r.augmentJob = (I) => {
    t && (I.flags |= 4), _ && (I.flags |= 2, d && (I.id = d.uid, I.i = d));
  };
  const S = qo(e, t, r);
  return Bt && (p ? p.push(S) : c && S()), S;
}
function zo(e, t, n) {
  const s = this.proxy, i = se(e) ? e.includes(".") ? bi(s, e) : () => s[e] : e.bind(s, s);
  let o;
  j(t) ? o = t : (o = t.handler, n = t);
  const l = $t(this), r = mi(i, o.bind(s), n);
  return l(), r;
}
function bi(e, t) {
  const n = t.split(".");
  return () => {
    let s = e;
    for (let i = 0; i < n.length && s; i++)
      s = s[n[i]];
    return s;
  };
}
const el = /* @__PURE__ */ Symbol("_vte"), tl = (e) => e.__isTeleport, nl = /* @__PURE__ */ Symbol("_leaveCb");
function Zn(e, t) {
  e.shapeFlag & 6 && e.component ? (e.transition = t, Zn(e.component.subTree, t)) : e.shapeFlag & 128 ? (e.ssContent.transition = t.clone(e.ssContent), e.ssFallback.transition = t.clone(e.ssFallback)) : e.transition = t;
}
function yi(e) {
  e.ids = [e.ids[0] + e.ids[2]++ + "-", 0, 0];
}
function gs(e, t) {
  let n;
  return !!((n = Object.getOwnPropertyDescriptor(e, t)) && !n.configurable);
}
const zt = /* @__PURE__ */ new WeakMap();
function Mt(e, t, n, s, i = !1) {
  if (F(e)) {
    e.forEach(
      (H, T) => Mt(
        H,
        t && (F(t) ? t[T] : t),
        n,
        s,
        i
      )
    );
    return;
  }
  if (It(s) && !i) {
    s.shapeFlag & 512 && s.type.__asyncResolved && s.component.subTree.component && Mt(e, t, n, s.component.subTree);
    return;
  }
  const o = s.shapeFlag & 4 ? es(s.component) : s.el, l = i ? null : o, { i: r, r: c } = e, p = t && t.r, d = r.refs === z ? r.refs = {} : r.refs, _ = r.setupState, S = /* @__PURE__ */ W(_), I = _ === z ? Us : (H) => gs(d, H) ? !1 : V(S, H), q = (H, T) => !(T && gs(d, T));
  if (p != null && p !== c) {
    if (_s(t), se(p))
      d[p] = null, I(p) && (_[p] = null);
    else if (/* @__PURE__ */ ce(p)) {
      const H = t;
      q(p, H.k) && (p.value = null), H.k && (d[H.k] = null);
    }
  }
  if (j(c))
    jt(c, r, 12, [l, d]);
  else {
    const H = se(c), T = /* @__PURE__ */ ce(c);
    if (H || T) {
      const X = () => {
        if (e.f) {
          const $ = H ? I(c) ? _[c] : d[c] : q() || !e.k ? c.value : d[e.k];
          if (i)
            F($) && Fn($, o);
          else if (F($))
            $.includes(o) || $.push(o);
          else if (H)
            d[c] = [o], I(c) && (_[c] = d[c]);
          else {
            const O = [o];
            q(c, e.k) && (c.value = O), e.k && (d[e.k] = O);
          }
        } else H ? (d[c] = l, I(c) && (_[c] = l)) : T && (q(c, e.k) && (c.value = l), e.k && (d[e.k] = l));
      };
      if (l) {
        const $ = () => {
          X(), zt.delete(e);
        };
        $.id = -1, zt.set(e, $), he($, n);
      } else
        _s(e), X();
    }
  }
}
function _s(e) {
  const t = zt.get(e);
  t && (t.flags |= 8, zt.delete(e));
}
ln().requestIdleCallback;
ln().cancelIdleCallback;
const It = (e) => !!e.type.__asyncLoader, xi = (e) => e.type.__isKeepAlive;
function sl(e, t) {
  Si(e, "a", t);
}
function il(e, t) {
  Si(e, "da", t);
}
function Si(e, t, n = pe) {
  const s = e.__wdc || (e.__wdc = () => {
    let i = n;
    for (; i; ) {
      if (i.isDeactivated)
        return;
      i = i.parent;
    }
    return e();
  });
  if (cn(t, s, n), n) {
    let i = n.parent;
    for (; i && i.parent; )
      xi(i.parent.vnode) && ol(s, t, n, i), i = i.parent;
  }
}
function ol(e, t, n, s) {
  const i = cn(
    t,
    e,
    s,
    !0
    /* prepend */
  );
  ki(() => {
    Fn(s[t], i);
  }, n);
}
function cn(e, t, n = pe, s = !1) {
  if (n) {
    const i = n[e] || (n[e] = []), o = t.__weh || (t.__weh = (...l) => {
      Ve();
      const r = $t(n), c = Ne(t, n, e, l);
      return r(), Ge(), c;
    });
    return s ? i.unshift(o) : i.push(o), o;
  }
}
const Xe = (e) => (t, n = pe) => {
  (!Bt || e === "sp") && cn(e, (...s) => t(...s), n);
}, ll = Xe("bm"), Ci = Xe("m"), rl = Xe(
  "bu"
), al = Xe("u"), wi = Xe(
  "bum"
), ki = Xe("um"), cl = Xe(
  "sp"
), ul = Xe("rtg"), fl = Xe("rtc");
function dl(e, t = pe) {
  cn("ec", e, t);
}
const pl = /* @__PURE__ */ Symbol.for("v-ndc");
function dt(e, t, n, s) {
  let i;
  const o = n, l = F(e);
  if (l || se(e)) {
    const r = l && /* @__PURE__ */ rt(e);
    let c = !1, p = !1;
    r && (c = !/* @__PURE__ */ ye(e), p = /* @__PURE__ */ Qe(e), e = rn(e)), i = new Array(e.length);
    for (let d = 0, _ = e.length; d < _; d++)
      i[d] = t(
        c ? p ? mt(ke(e[d])) : ke(e[d]) : e[d],
        d,
        void 0,
        o
      );
  } else if (typeof e == "number") {
    i = new Array(e);
    for (let r = 0; r < e; r++)
      i[r] = t(r + 1, r, void 0, o);
  } else if (G(e))
    if (e[Symbol.iterator])
      i = Array.from(
        e,
        (r, c) => t(r, c, void 0, o)
      );
    else {
      const r = Object.keys(e);
      i = new Array(r.length);
      for (let c = 0, p = r.length; c < p; c++) {
        const d = r[c];
        i[c] = t(e[d], d, c, o);
      }
    }
  else
    i = [];
  return i;
}
const En = (e) => e ? Vi(e) ? es(e) : En(e.parent) : null, Ot = (
  // Move PURE marker to new line to workaround compiler discarding it
  // due to type annotation
  /* @__PURE__ */ ue(/* @__PURE__ */ Object.create(null), {
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
    $options: (e) => Ai(e),
    $forceUpdate: (e) => e.f || (e.f = () => {
      Xn(e.update);
    }),
    $nextTick: (e) => e.n || (e.n = Vo.bind(e.proxy)),
    $watch: (e) => zo.bind(e)
  })
), yn = (e, t) => e !== z && !e.__isScriptSetup && V(e, t), hl = {
  get({ _: e }, t) {
    if (t === "__v_skip")
      return !0;
    const { ctx: n, setupState: s, data: i, props: o, accessCache: l, type: r, appContext: c } = e;
    if (t[0] !== "$") {
      const S = l[t];
      if (S !== void 0)
        switch (S) {
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
        if (yn(s, t))
          return l[t] = 1, s[t];
        if (i !== z && V(i, t))
          return l[t] = 2, i[t];
        if (V(o, t))
          return l[t] = 3, o[t];
        if (n !== z && V(n, t))
          return l[t] = 4, n[t];
        Mn && (l[t] = 0);
      }
    }
    const p = Ot[t];
    let d, _;
    if (p)
      return t === "$attrs" && ae(e.attrs, "get", ""), p(e);
    if (
      // css module (injected by vue-loader)
      (d = r.__cssModules) && (d = d[t])
    )
      return d;
    if (n !== z && V(n, t))
      return l[t] = 4, n[t];
    if (
      // global properties
      _ = c.config.globalProperties, V(_, t)
    )
      return _[t];
  },
  set({ _: e }, t, n) {
    const { data: s, setupState: i, ctx: o } = e;
    return yn(i, t) ? (i[t] = n, !0) : s !== z && V(s, t) ? (s[t] = n, !0) : V(e.props, t) || t[0] === "$" && t.slice(1) in e ? !1 : (o[t] = n, !0);
  },
  has({
    _: { data: e, setupState: t, accessCache: n, ctx: s, appContext: i, props: o, type: l }
  }, r) {
    let c;
    return !!(n[r] || e !== z && r[0] !== "$" && V(e, r) || yn(t, r) || V(o, r) || V(s, r) || V(Ot, r) || V(i.config.globalProperties, r) || (c = l.__cssModules) && c[r]);
  },
  defineProperty(e, t, n) {
    return n.get != null ? e._.accessCache[t] = 0 : V(n, "value") && this.set(e, t, n.value, null), Reflect.defineProperty(e, t, n);
  }
};
function vs(e) {
  return F(e) ? e.reduce(
    (t, n) => (t[n] = null, t),
    {}
  ) : e;
}
let Mn = !0;
function gl(e) {
  const t = Ai(e), n = e.proxy, s = e.ctx;
  Mn = !1, t.beforeCreate && ms(t.beforeCreate, e, "bc");
  const {
    // state
    data: i,
    computed: o,
    methods: l,
    watch: r,
    provide: c,
    inject: p,
    // lifecycle
    created: d,
    beforeMount: _,
    mounted: S,
    beforeUpdate: I,
    updated: q,
    activated: H,
    deactivated: T,
    beforeDestroy: X,
    beforeUnmount: $,
    destroyed: O,
    unmounted: P,
    render: M,
    renderTracked: xe,
    renderTriggered: be,
    errorCaptured: Se,
    serverPrefetch: ct,
    // public API
    expose: ge,
    inheritAttrs: et,
    // assets
    components: ut,
    directives: te,
    filters: g
  } = t;
  if (p && _l(p, s, null), l)
    for (const ne in l) {
      const Z = l[ne];
      j(Z) && (s[ne] = Z.bind(n));
    }
  if (i) {
    const ne = i.call(n, n);
    G(ne) && (e.data = /* @__PURE__ */ Vn(ne));
  }
  if (Mn = !0, o)
    for (const ne in o) {
      const Z = o[ne], tt = j(Z) ? Z.bind(n, n) : j(Z.get) ? Z.get.bind(n, n) : He, Ut = !j(Z) && j(Z.set) ? Z.set.bind(n) : He, nt = ve({
        get: tt,
        set: Ut
      });
      Object.defineProperty(s, ne, {
        enumerable: !0,
        configurable: !0,
        get: () => nt.value,
        set: (Te) => nt.value = Te
      });
    }
  if (r)
    for (const ne in r)
      Ti(r[ne], s, n, ne);
  if (c) {
    const ne = j(c) ? c.call(n) : c;
    Reflect.ownKeys(ne).forEach((Z) => {
      Zo(Z, ne[Z]);
    });
  }
  d && ms(d, e, "c");
  function U(ne, Z) {
    F(Z) ? Z.forEach((tt) => ne(tt.bind(n))) : Z && ne(Z.bind(n));
  }
  if (U(ll, _), U(Ci, S), U(rl, I), U(al, q), U(sl, H), U(il, T), U(dl, Se), U(fl, xe), U(ul, be), U(wi, $), U(ki, P), U(cl, ct), F(ge))
    if (ge.length) {
      const ne = e.exposed || (e.exposed = {});
      ge.forEach((Z) => {
        Object.defineProperty(ne, Z, {
          get: () => n[Z],
          set: (tt) => n[Z] = tt,
          enumerable: !0
        });
      });
    } else e.exposed || (e.exposed = {});
  M && e.render === He && (e.render = M), et != null && (e.inheritAttrs = et), ut && (e.components = ut), te && (e.directives = te), ct && yi(e);
}
function _l(e, t, n = He) {
  F(e) && (e = In(e));
  for (const s in e) {
    const i = e[s];
    let o;
    G(i) ? "default" in i ? o = Gt(
      i.from || s,
      i.default,
      !0
    ) : o = Gt(i.from || s) : o = Gt(i), /* @__PURE__ */ ce(o) ? Object.defineProperty(t, s, {
      enumerable: !0,
      configurable: !0,
      get: () => o.value,
      set: (l) => o.value = l
    }) : t[s] = o;
  }
}
function ms(e, t, n) {
  Ne(
    F(e) ? e.map((s) => s.bind(t.proxy)) : e.bind(t.proxy),
    t,
    n
  );
}
function Ti(e, t, n, s) {
  let i = s.includes(".") ? bi(n, s) : () => n[s];
  if (se(e)) {
    const o = t[e];
    j(o) && bn(i, o);
  } else if (j(e))
    bn(i, e.bind(n));
  else if (G(e))
    if (F(e))
      e.forEach((o) => Ti(o, t, n, s));
    else {
      const o = j(e.handler) ? e.handler.bind(n) : t[e.handler];
      j(o) && bn(i, o, e);
    }
}
function Ai(e) {
  const t = e.type, { mixins: n, extends: s } = t, {
    mixins: i,
    optionsCache: o,
    config: { optionMergeStrategies: l }
  } = e.appContext, r = o.get(t);
  let c;
  return r ? c = r : !i.length && !n && !s ? c = t : (c = {}, i.length && i.forEach(
    (p) => en(c, p, l, !0)
  ), en(c, t, l)), G(t) && o.set(t, c), c;
}
function en(e, t, n, s = !1) {
  const { mixins: i, extends: o } = t;
  o && en(e, o, n, !0), i && i.forEach(
    (l) => en(e, l, n, !0)
  );
  for (const l in t)
    if (!(s && l === "expose")) {
      const r = vl[l] || n && n[l];
      e[l] = r ? r(e[l], t[l]) : t[l];
    }
  return e;
}
const vl = {
  data: bs,
  props: ys,
  emits: ys,
  // objects
  methods: kt,
  computed: kt,
  // lifecycle
  beforeCreate: fe,
  created: fe,
  beforeMount: fe,
  mounted: fe,
  beforeUpdate: fe,
  updated: fe,
  beforeDestroy: fe,
  beforeUnmount: fe,
  destroyed: fe,
  unmounted: fe,
  activated: fe,
  deactivated: fe,
  errorCaptured: fe,
  serverPrefetch: fe,
  // assets
  components: kt,
  directives: kt,
  // watch
  watch: bl,
  // provide / inject
  provide: bs,
  inject: ml
};
function bs(e, t) {
  return t ? e ? function() {
    return ue(
      j(e) ? e.call(this, this) : e,
      j(t) ? t.call(this, this) : t
    );
  } : t : e;
}
function ml(e, t) {
  return kt(In(e), In(t));
}
function In(e) {
  if (F(e)) {
    const t = {};
    for (let n = 0; n < e.length; n++)
      t[e[n]] = e[n];
    return t;
  }
  return e;
}
function fe(e, t) {
  return e ? [...new Set([].concat(e, t))] : t;
}
function kt(e, t) {
  return e ? ue(/* @__PURE__ */ Object.create(null), e, t) : t;
}
function ys(e, t) {
  return e ? F(e) && F(t) ? [.../* @__PURE__ */ new Set([...e, ...t])] : ue(
    /* @__PURE__ */ Object.create(null),
    vs(e),
    vs(t ?? {})
  ) : t;
}
function bl(e, t) {
  if (!e) return t;
  if (!t) return e;
  const n = ue(/* @__PURE__ */ Object.create(null), e);
  for (const s in t)
    n[s] = fe(e[s], t[s]);
  return n;
}
function Pi() {
  return {
    app: null,
    config: {
      isNativeTag: Us,
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
let yl = 0;
function xl(e, t) {
  return function(s, i = null) {
    j(s) || (s = ue({}, s)), i != null && !G(i) && (i = null);
    const o = Pi(), l = /* @__PURE__ */ new WeakSet(), r = [];
    let c = !1;
    const p = o.app = {
      _uid: yl++,
      _component: s,
      _props: i,
      _container: null,
      _context: o,
      _instance: null,
      version: tr,
      get config() {
        return o.config;
      },
      set config(d) {
      },
      use(d, ..._) {
        return l.has(d) || (d && j(d.install) ? (l.add(d), d.install(p, ..._)) : j(d) && (l.add(d), d(p, ..._))), p;
      },
      mixin(d) {
        return o.mixins.includes(d) || o.mixins.push(d), p;
      },
      component(d, _) {
        return _ ? (o.components[d] = _, p) : o.components[d];
      },
      directive(d, _) {
        return _ ? (o.directives[d] = _, p) : o.directives[d];
      },
      mount(d, _, S) {
        if (!c) {
          const I = p._ceVNode || Fe(s, i);
          return I.appContext = o, S === !0 ? S = "svg" : S === !1 && (S = void 0), e(I, d, S), c = !0, p._container = d, d.__vue_app__ = p, es(I.component);
        }
      },
      onUnmount(d) {
        r.push(d);
      },
      unmount() {
        c && (Ne(
          r,
          p._instance,
          16
        ), e(null, p._container), delete p._container.__vue_app__);
      },
      provide(d, _) {
        return o.provides[d] = _, p;
      },
      runWithContext(d) {
        const _ = vt;
        vt = p;
        try {
          return d();
        } finally {
          vt = _;
        }
      }
    };
    return p;
  };
}
let vt = null;
const Sl = (e, t) => t === "modelValue" || t === "model-value" ? e.modelModifiers : e[`${t}Modifiers`] || e[`${Ce(t)}Modifiers`] || e[`${at(t)}Modifiers`];
function Cl(e, t, ...n) {
  if (e.isUnmounted) return;
  const s = e.vnode.props || z;
  let i = n;
  const o = t.startsWith("update:"), l = o && Sl(s, t.slice(7));
  l && (l.trim && (i = n.map((d) => se(d) ? d.trim() : d)), l.number && (i = n.map(oo)));
  let r, c = s[r = pn(t)] || // also try camelCase event handler (#2249)
  s[r = pn(Ce(t))];
  !c && o && (c = s[r = pn(at(t))]), c && Ne(
    c,
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
    e.emitted[r] = !0, Ne(
      p,
      e,
      6,
      i
    );
  }
}
const wl = /* @__PURE__ */ new WeakMap();
function Ei(e, t, n = !1) {
  const s = n ? wl : t.emitsCache, i = s.get(e);
  if (i !== void 0)
    return i;
  const o = e.emits;
  let l = {}, r = !1;
  if (!j(e)) {
    const c = (p) => {
      const d = Ei(p, t, !0);
      d && (r = !0, ue(l, d));
    };
    !n && t.mixins.length && t.mixins.forEach(c), e.extends && c(e.extends), e.mixins && e.mixins.forEach(c);
  }
  return !o && !r ? (G(e) && s.set(e, null), null) : (F(o) ? o.forEach((c) => l[c] = null) : ue(l, o), G(e) && s.set(e, l), l);
}
function un(e, t) {
  return !e || !nn(t) ? !1 : (t = t.slice(2).replace(/Once$/, ""), V(e, t[0].toLowerCase() + t.slice(1)) || V(e, at(t)) || V(e, t));
}
function xs(e) {
  const {
    type: t,
    vnode: n,
    proxy: s,
    withProxy: i,
    propsOptions: [o],
    slots: l,
    attrs: r,
    emit: c,
    render: p,
    renderCache: d,
    props: _,
    data: S,
    setupState: I,
    ctx: q,
    inheritAttrs: H
  } = e, T = Yt(e);
  let X, $;
  try {
    if (n.shapeFlag & 4) {
      const P = i || s, M = P;
      X = Le(
        p.call(
          M,
          P,
          d,
          _,
          I,
          S,
          q
        )
      ), $ = r;
    } else {
      const P = t;
      X = Le(
        P.length > 1 ? P(
          _,
          { attrs: r, slots: l, emit: c }
        ) : P(
          _,
          null
        )
      ), $ = t.props ? r : kl(r);
    }
  } catch (P) {
    Lt.length = 0, an(P, e, 1), X = Fe(ze);
  }
  let O = X;
  if ($ && H !== !1) {
    const P = Object.keys($), { shapeFlag: M } = O;
    P.length && M & 7 && (o && P.some(sn) && ($ = Tl(
      $,
      o
    )), O = bt(O, $, !1, !0));
  }
  return n.dirs && (O = bt(O, null, !1, !0), O.dirs = O.dirs ? O.dirs.concat(n.dirs) : n.dirs), n.transition && Zn(O, n.transition), X = O, Yt(T), X;
}
const kl = (e) => {
  let t;
  for (const n in e)
    (n === "class" || n === "style" || nn(n)) && ((t || (t = {}))[n] = e[n]);
  return t;
}, Tl = (e, t) => {
  const n = {};
  for (const s in e)
    (!sn(s) || !(s.slice(9) in t)) && (n[s] = e[s]);
  return n;
};
function Al(e, t, n) {
  const { props: s, children: i, component: o } = e, { props: l, children: r, patchFlag: c } = t, p = o.emitsOptions;
  if (t.dirs || t.transition)
    return !0;
  if (n && c >= 0) {
    if (c & 1024)
      return !0;
    if (c & 16)
      return s ? Ss(s, l, p) : !!l;
    if (c & 8) {
      const d = t.dynamicProps;
      for (let _ = 0; _ < d.length; _++) {
        const S = d[_];
        if (Mi(l, s, S) && !un(p, S))
          return !0;
      }
    }
  } else
    return (i || r) && (!r || !r.$stable) ? !0 : s === l ? !1 : s ? l ? Ss(s, l, p) : !0 : !!l;
  return !1;
}
function Ss(e, t, n) {
  const s = Object.keys(t);
  if (s.length !== Object.keys(e).length)
    return !0;
  for (let i = 0; i < s.length; i++) {
    const o = s[i];
    if (Mi(t, e, o) && !un(n, o))
      return !0;
  }
  return !1;
}
function Mi(e, t, n) {
  const s = e[n], i = t[n];
  return n === "style" && G(s) && G(i) ? !jn(s, i) : s !== i;
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
const Ii = {}, Oi = () => Object.create(Ii), Li = (e) => Object.getPrototypeOf(e) === Ii;
function El(e, t, n, s = !1) {
  const i = {}, o = Oi();
  e.propsDefaults = /* @__PURE__ */ Object.create(null), Ri(e, t, i, o);
  for (const l in e.propsOptions[0])
    l in i || (i[l] = void 0);
  n ? e.props = s ? i : /* @__PURE__ */ Ro(i) : e.type.props ? e.props = i : e.props = o, e.attrs = o;
}
function Ml(e, t, n, s) {
  const {
    props: i,
    attrs: o,
    vnode: { patchFlag: l }
  } = e, r = /* @__PURE__ */ W(i), [c] = e.propsOptions;
  let p = !1;
  if (
    // always force full diff in dev
    // - #1942 if hmr is enabled with sfc component
    // - vite#872 non-sfc component used by sfc component
    (s || l > 0) && !(l & 16)
  ) {
    if (l & 8) {
      const d = e.vnode.dynamicProps;
      for (let _ = 0; _ < d.length; _++) {
        let S = d[_];
        if (un(e.emitsOptions, S))
          continue;
        const I = t[S];
        if (c)
          if (V(o, S))
            I !== o[S] && (o[S] = I, p = !0);
          else {
            const q = Ce(S);
            i[q] = On(
              c,
              r,
              q,
              I,
              e,
              !1
            );
          }
        else
          I !== o[S] && (o[S] = I, p = !0);
      }
    }
  } else {
    Ri(e, t, i, o) && (p = !0);
    let d;
    for (const _ in r)
      (!t || // for camelCase
      !V(t, _) && // it's possible the original props was passed in as kebab-case
      // and converted to camelCase (#955)
      ((d = at(_)) === _ || !V(t, d))) && (c ? n && // for camelCase
      (n[_] !== void 0 || // for kebab-case
      n[d] !== void 0) && (i[_] = On(
        c,
        r,
        _,
        void 0,
        e,
        !0
      )) : delete i[_]);
    if (o !== r)
      for (const _ in o)
        (!t || !V(t, _)) && (delete o[_], p = !0);
  }
  p && We(e.attrs, "set", "");
}
function Ri(e, t, n, s) {
  const [i, o] = e.propsOptions;
  let l = !1, r;
  if (t)
    for (let c in t) {
      if (At(c))
        continue;
      const p = t[c];
      let d;
      i && V(i, d = Ce(c)) ? !o || !o.includes(d) ? n[d] = p : (r || (r = {}))[d] = p : un(e.emitsOptions, c) || (!(c in s) || p !== s[c]) && (s[c] = p, l = !0);
    }
  if (o) {
    const c = /* @__PURE__ */ W(n), p = r || z;
    for (let d = 0; d < o.length; d++) {
      const _ = o[d];
      n[_] = On(
        i,
        c,
        _,
        p[_],
        e,
        !V(p, _)
      );
    }
  }
  return l;
}
function On(e, t, n, s, i, o) {
  const l = e[n];
  if (l != null) {
    const r = V(l, "default");
    if (r && s === void 0) {
      const c = l.default;
      if (l.type !== Function && !l.skipFactory && j(c)) {
        const { propsDefaults: p } = i;
        if (n in p)
          s = p[n];
        else {
          const d = $t(i);
          s = p[n] = c.call(
            null,
            t
          ), d();
        }
      } else
        s = c;
      i.ce && i.ce._setProp(n, s);
    }
    l[
      0
      /* shouldCast */
    ] && (o && !r ? s = !1 : l[
      1
      /* shouldCastTrue */
    ] && (s === "" || s === at(n)) && (s = !0));
  }
  return s;
}
const Il = /* @__PURE__ */ new WeakMap();
function Di(e, t, n = !1) {
  const s = n ? Il : t.propsCache, i = s.get(e);
  if (i)
    return i;
  const o = e.props, l = {}, r = [];
  let c = !1;
  if (!j(e)) {
    const d = (_) => {
      c = !0;
      const [S, I] = Di(_, t, !0);
      ue(l, S), I && r.push(...I);
    };
    !n && t.mixins.length && t.mixins.forEach(d), e.extends && d(e.extends), e.mixins && e.mixins.forEach(d);
  }
  if (!o && !c)
    return G(e) && s.set(e, ht), ht;
  if (F(o))
    for (let d = 0; d < o.length; d++) {
      const _ = Ce(o[d]);
      Cs(_) && (l[_] = z);
    }
  else if (o)
    for (const d in o) {
      const _ = Ce(d);
      if (Cs(_)) {
        const S = o[d], I = l[_] = F(S) || j(S) ? { type: S } : ue({}, S), q = I.type;
        let H = !1, T = !0;
        if (F(q))
          for (let X = 0; X < q.length; ++X) {
            const $ = q[X], O = j($) && $.name;
            if (O === "Boolean") {
              H = !0;
              break;
            } else O === "String" && (T = !1);
          }
        else
          H = j(q) && q.name === "Boolean";
        I[
          0
          /* shouldCast */
        ] = H, I[
          1
          /* shouldCastTrue */
        ] = T, (H || V(I, "default")) && r.push(_);
      }
    }
  const p = [l, r];
  return G(e) && s.set(e, p), p;
}
function Cs(e) {
  return e[0] !== "$" && !At(e);
}
const Jn = (e) => e === "_" || e === "_ctx" || e === "$stable", Yn = (e) => F(e) ? e.map(Le) : [Le(e)], Ol = (e, t, n) => {
  if (t._n)
    return t;
  const s = Xo((...i) => Yn(t(...i)), n);
  return s._c = !1, s;
}, Hi = (e, t, n) => {
  const s = e._ctx;
  for (const i in e) {
    if (Jn(i)) continue;
    const o = e[i];
    if (j(o))
      t[i] = Ol(i, o, s);
    else if (o != null) {
      const l = Yn(o);
      t[i] = () => l;
    }
  }
}, Fi = (e, t) => {
  const n = Yn(t);
  e.slots.default = () => n;
}, Bi = (e, t, n) => {
  for (const s in t)
    (n || !Jn(s)) && (e[s] = t[s]);
}, Ll = (e, t, n) => {
  const s = e.slots = Oi();
  if (e.vnode.shapeFlag & 32) {
    const i = t._;
    i ? (Bi(s, t, n), n && Qs(s, "_", i, !0)) : Hi(t, s);
  } else t && Fi(e, t);
}, Rl = (e, t, n) => {
  const { vnode: s, slots: i } = e;
  let o = !0, l = z;
  if (s.shapeFlag & 32) {
    const r = t._;
    r ? n && r === 1 ? o = !1 : Bi(i, t, n) : (o = !t.$stable, Hi(t, i)), l = t;
  } else t && (Fi(e, t), l = { default: 1 });
  if (o)
    for (const r in i)
      !Jn(r) && l[r] == null && delete i[r];
}, he = Nl;
function Dl(e) {
  return Hl(e);
}
function Hl(e, t) {
  const n = ln();
  n.__VUE__ = !0;
  const {
    insert: s,
    remove: i,
    patchProp: o,
    createElement: l,
    createText: r,
    createComment: c,
    setText: p,
    setElementText: d,
    parentNode: _,
    nextSibling: S,
    setScopeId: I = He,
    insertStaticContent: q
  } = e, H = (a, u, h, y = null, v = null, m = null, k = void 0, w = null, C = !!u.dynamicChildren) => {
    if (a === u)
      return;
    a && !wt(a, u) && (y = Kt(a), Te(a, v, m, !0), a = null), u.patchFlag === -2 && (C = !1, u.dynamicChildren = null);
    const { type: b, ref: R, shapeFlag: A } = u;
    switch (b) {
      case fn:
        T(a, u, h, y);
        break;
      case ze:
        X(a, u, h, y);
        break;
      case Qt:
        a == null && $(u, h, y, k);
        break;
      case ee:
        ut(
          a,
          u,
          h,
          y,
          v,
          m,
          k,
          w,
          C
        );
        break;
      default:
        A & 1 ? M(
          a,
          u,
          h,
          y,
          v,
          m,
          k,
          w,
          C
        ) : A & 6 ? te(
          a,
          u,
          h,
          y,
          v,
          m,
          k,
          w,
          C
        ) : (A & 64 || A & 128) && b.process(
          a,
          u,
          h,
          y,
          v,
          m,
          k,
          w,
          C,
          xt
        );
    }
    R != null && v ? Mt(R, a && a.ref, m, u || a, !u) : R == null && a && a.ref != null && Mt(a.ref, null, m, a, !0);
  }, T = (a, u, h, y) => {
    if (a == null)
      s(
        u.el = r(u.children),
        h,
        y
      );
    else {
      const v = u.el = a.el;
      u.children !== a.children && p(v, u.children);
    }
  }, X = (a, u, h, y) => {
    a == null ? s(
      u.el = c(u.children || ""),
      h,
      y
    ) : u.el = a.el;
  }, $ = (a, u, h, y) => {
    [a.el, a.anchor] = q(
      a.children,
      u,
      h,
      y,
      a.el,
      a.anchor
    );
  }, O = ({ el: a, anchor: u }, h, y) => {
    let v;
    for (; a && a !== u; )
      v = S(a), s(a, h, y), a = v;
    s(u, h, y);
  }, P = ({ el: a, anchor: u }) => {
    let h;
    for (; a && a !== u; )
      h = S(a), i(a), a = h;
    i(u);
  }, M = (a, u, h, y, v, m, k, w, C) => {
    if (u.type === "svg" ? k = "svg" : u.type === "math" && (k = "mathml"), a == null)
      xe(
        u,
        h,
        y,
        v,
        m,
        k,
        w,
        C
      );
    else {
      const b = a.el && a.el._isVueCE ? a.el : null;
      try {
        b && b._beginPatch(), ct(
          a,
          u,
          v,
          m,
          k,
          w,
          C
        );
      } finally {
        b && b._endPatch();
      }
    }
  }, xe = (a, u, h, y, v, m, k, w) => {
    let C, b;
    const { props: R, shapeFlag: A, transition: L, dirs: D } = a;
    if (C = a.el = l(
      a.type,
      m,
      R && R.is,
      R
    ), A & 8 ? d(C, a.children) : A & 16 && Se(
      a.children,
      C,
      null,
      y,
      v,
      xn(a, m),
      k,
      w
    ), D && st(a, null, y, "created"), be(C, a, a.scopeId, k, y), R) {
      for (const Q in R)
        Q !== "value" && !At(Q) && o(C, Q, null, R[Q], m, y);
      "value" in R && o(C, "value", null, R.value, m), (b = R.onVnodeBeforeMount) && Me(b, y, a);
    }
    D && st(a, null, y, "beforeMount");
    const K = Fl(v, L);
    K && L.beforeEnter(C), s(C, u, h), ((b = R && R.onVnodeMounted) || K || D) && he(() => {
      b && Me(b, y, a), K && L.enter(C), D && st(a, null, y, "mounted");
    }, v);
  }, be = (a, u, h, y, v) => {
    if (h && I(a, h), y)
      for (let m = 0; m < y.length; m++)
        I(a, y[m]);
    if (v) {
      let m = v.subTree;
      if (u === m || Ui(m.type) && (m.ssContent === u || m.ssFallback === u)) {
        const k = v.vnode;
        be(
          a,
          k,
          k.scopeId,
          k.slotScopeIds,
          v.parent
        );
      }
    }
  }, Se = (a, u, h, y, v, m, k, w, C = 0) => {
    for (let b = C; b < a.length; b++) {
      const R = a[b] = w ? qe(a[b]) : Le(a[b]);
      H(
        null,
        R,
        u,
        h,
        y,
        v,
        m,
        k,
        w
      );
    }
  }, ct = (a, u, h, y, v, m, k) => {
    const w = u.el = a.el;
    let { patchFlag: C, dynamicChildren: b, dirs: R } = u;
    C |= a.patchFlag & 16;
    const A = a.props || z, L = u.props || z;
    let D;
    if (h && it(h, !1), (D = L.onVnodeBeforeUpdate) && Me(D, h, u, a), R && st(u, a, h, "beforeUpdate"), h && it(h, !0), (A.innerHTML && L.innerHTML == null || A.textContent && L.textContent == null) && d(w, ""), b ? ge(
      a.dynamicChildren,
      b,
      w,
      h,
      y,
      xn(u, v),
      m
    ) : k || Z(
      a,
      u,
      w,
      null,
      h,
      y,
      xn(u, v),
      m,
      !1
    ), C > 0) {
      if (C & 16)
        et(w, A, L, h, v);
      else if (C & 2 && A.class !== L.class && o(w, "class", null, L.class, v), C & 4 && o(w, "style", A.style, L.style, v), C & 8) {
        const K = u.dynamicProps;
        for (let Q = 0; Q < K.length; Q++) {
          const J = K[Q], ie = A[J], le = L[J];
          (le !== ie || J === "value") && o(w, J, ie, le, v, h);
        }
      }
      C & 1 && a.children !== u.children && d(w, u.children);
    } else !k && b == null && et(w, A, L, h, v);
    ((D = L.onVnodeUpdated) || R) && he(() => {
      D && Me(D, h, u, a), R && st(u, a, h, "updated");
    }, y);
  }, ge = (a, u, h, y, v, m, k) => {
    for (let w = 0; w < u.length; w++) {
      const C = a[w], b = u[w], R = (
        // oldVNode may be an errored async setup() component inside Suspense
        // which will not have a mounted element
        C.el && // - In the case of a Fragment, we need to provide the actual parent
        // of the Fragment itself so it can move its children.
        (C.type === ee || // - In the case of different nodes, there is going to be a replacement
        // which also requires the correct parent container
        !wt(C, b) || // - In the case of a component, it could contain anything.
        C.shapeFlag & 198) ? _(C.el) : (
          // In other cases, the parent container is not actually used so we
          // just pass the block element here to avoid a DOM parentNode call.
          h
        )
      );
      H(
        C,
        b,
        R,
        null,
        y,
        v,
        m,
        k,
        !0
      );
    }
  }, et = (a, u, h, y, v) => {
    if (u !== h) {
      if (u !== z)
        for (const m in u)
          !At(m) && !(m in h) && o(
            a,
            m,
            u[m],
            null,
            v,
            y
          );
      for (const m in h) {
        if (At(m)) continue;
        const k = h[m], w = u[m];
        k !== w && m !== "value" && o(a, m, w, k, v, y);
      }
      "value" in h && o(a, "value", u.value, h.value, v);
    }
  }, ut = (a, u, h, y, v, m, k, w, C) => {
    const b = u.el = a ? a.el : r(""), R = u.anchor = a ? a.anchor : r("");
    let { patchFlag: A, dynamicChildren: L, slotScopeIds: D } = u;
    D && (w = w ? w.concat(D) : D), a == null ? (s(b, h, y), s(R, h, y), Se(
      // #10007
      // such fragment like `<></>` will be compiled into
      // a fragment which doesn't have a children.
      // In this case fallback to an empty array
      u.children || [],
      h,
      R,
      v,
      m,
      k,
      w,
      C
    )) : A > 0 && A & 64 && L && // #2715 the previous fragment could've been a BAILed one as a result
    // of renderSlot() with no valid children
    a.dynamicChildren && a.dynamicChildren.length === L.length ? (ge(
      a.dynamicChildren,
      L,
      h,
      v,
      m,
      k,
      w
    ), // #2080 if the stable fragment has a key, it's a <template v-for> that may
    //  get moved around. Make sure all root level vnodes inherit el.
    // #2134 or if it's a component root, it may also get moved around
    // as the component is being moved.
    (u.key != null || v && u === v.subTree) && Ni(
      a,
      u,
      !0
      /* shallow */
    )) : Z(
      a,
      u,
      h,
      R,
      v,
      m,
      k,
      w,
      C
    );
  }, te = (a, u, h, y, v, m, k, w, C) => {
    u.slotScopeIds = w, a == null ? u.shapeFlag & 512 ? v.ctx.activate(
      u,
      h,
      y,
      k,
      C
    ) : g(
      u,
      h,
      y,
      v,
      m,
      k,
      C
    ) : x(a, u, C);
  }, g = (a, u, h, y, v, m, k) => {
    const w = a.component = Ql(
      a,
      y,
      v
    );
    if (xi(a) && (w.ctx.renderer = xt), Zl(w, !1, k), w.asyncDep) {
      if (v && v.registerDep(w, U, k), !a.el) {
        const C = w.subTree = Fe(ze);
        X(null, C, u, h), a.placeholder = C.el;
      }
    } else
      U(
        w,
        a,
        u,
        h,
        v,
        m,
        k
      );
  }, x = (a, u, h) => {
    const y = u.component = a.component;
    if (Al(a, u, h))
      if (y.asyncDep && !y.asyncResolved) {
        ne(y, u, h);
        return;
      } else
        y.next = u, y.update();
    else
      u.el = a.el, y.vnode = u;
  }, U = (a, u, h, y, v, m, k) => {
    const w = () => {
      if (a.isMounted) {
        let { next: A, bu: L, u: D, parent: K, vnode: Q } = a;
        {
          const Pe = ji(a);
          if (Pe) {
            A && (A.el = Q.el, ne(a, A, k)), Pe.asyncDep.then(() => {
              he(() => {
                a.isUnmounted || b();
              }, v);
            });
            return;
          }
        }
        let J = A, ie;
        it(a, !1), A ? (A.el = Q.el, ne(a, A, k)) : A = Q, L && hn(L), (ie = A.props && A.props.onVnodeBeforeUpdate) && Me(ie, K, A, Q), it(a, !0);
        const le = xs(a), Ae = a.subTree;
        a.subTree = le, H(
          Ae,
          le,
          // parent may have changed if it's in a teleport
          _(Ae.el),
          // anchor may have changed if it's in a fragment
          Kt(Ae),
          a,
          v,
          m
        ), A.el = le.el, J === null && Pl(a, le.el), D && he(D, v), (ie = A.props && A.props.onVnodeUpdated) && he(
          () => Me(ie, K, A, Q),
          v
        );
      } else {
        let A;
        const { el: L, props: D } = u, { bm: K, m: Q, parent: J, root: ie, type: le } = a, Ae = It(u);
        it(a, !1), K && hn(K), !Ae && (A = D && D.onVnodeBeforeMount) && Me(A, J, u), it(a, !0);
        {
          ie.ce && ie.ce._hasShadowRoot() && ie.ce._injectChildStyle(
            le,
            a.parent ? a.parent.type : void 0
          );
          const Pe = a.subTree = xs(a);
          H(
            null,
            Pe,
            h,
            y,
            a,
            v,
            m
          ), u.el = Pe.el;
        }
        if (Q && he(Q, v), !Ae && (A = D && D.onVnodeMounted)) {
          const Pe = u;
          he(
            () => Me(A, J, Pe),
            v
          );
        }
        (u.shapeFlag & 256 || J && It(J.vnode) && J.vnode.shapeFlag & 256) && a.a && he(a.a, v), a.isMounted = !0, u = h = y = null;
      }
    };
    a.scope.on();
    const C = a.effect = new Ys(w);
    a.scope.off();
    const b = a.update = C.run.bind(C), R = a.job = C.runIfDirty.bind(C);
    R.i = a, R.id = a.uid, C.scheduler = () => Xn(R), it(a, !0), b();
  }, ne = (a, u, h) => {
    u.component = a;
    const y = a.vnode.props;
    a.vnode = u, a.next = null, Ml(a, u.props, y, h), Rl(a, u.children, h), Ve(), hs(a), Ge();
  }, Z = (a, u, h, y, v, m, k, w, C = !1) => {
    const b = a && a.children, R = a ? a.shapeFlag : 0, A = u.children, { patchFlag: L, shapeFlag: D } = u;
    if (L > 0) {
      if (L & 128) {
        Ut(
          b,
          A,
          h,
          y,
          v,
          m,
          k,
          w,
          C
        );
        return;
      } else if (L & 256) {
        tt(
          b,
          A,
          h,
          y,
          v,
          m,
          k,
          w,
          C
        );
        return;
      }
    }
    D & 8 ? (R & 16 && yt(b, v, m), A !== b && d(h, A)) : R & 16 ? D & 16 ? Ut(
      b,
      A,
      h,
      y,
      v,
      m,
      k,
      w,
      C
    ) : yt(b, v, m, !0) : (R & 8 && d(h, ""), D & 16 && Se(
      A,
      h,
      y,
      v,
      m,
      k,
      w,
      C
    ));
  }, tt = (a, u, h, y, v, m, k, w, C) => {
    a = a || ht, u = u || ht;
    const b = a.length, R = u.length, A = Math.min(b, R);
    let L;
    for (L = 0; L < A; L++) {
      const D = u[L] = C ? qe(u[L]) : Le(u[L]);
      H(
        a[L],
        D,
        h,
        null,
        v,
        m,
        k,
        w,
        C
      );
    }
    b > R ? yt(
      a,
      v,
      m,
      !0,
      !1,
      A
    ) : Se(
      u,
      h,
      y,
      v,
      m,
      k,
      w,
      C,
      A
    );
  }, Ut = (a, u, h, y, v, m, k, w, C) => {
    let b = 0;
    const R = u.length;
    let A = a.length - 1, L = R - 1;
    for (; b <= A && b <= L; ) {
      const D = a[b], K = u[b] = C ? qe(u[b]) : Le(u[b]);
      if (wt(D, K))
        H(
          D,
          K,
          h,
          null,
          v,
          m,
          k,
          w,
          C
        );
      else
        break;
      b++;
    }
    for (; b <= A && b <= L; ) {
      const D = a[A], K = u[L] = C ? qe(u[L]) : Le(u[L]);
      if (wt(D, K))
        H(
          D,
          K,
          h,
          null,
          v,
          m,
          k,
          w,
          C
        );
      else
        break;
      A--, L--;
    }
    if (b > A) {
      if (b <= L) {
        const D = L + 1, K = D < R ? u[D].el : y;
        for (; b <= L; )
          H(
            null,
            u[b] = C ? qe(u[b]) : Le(u[b]),
            h,
            K,
            v,
            m,
            k,
            w,
            C
          ), b++;
      }
    } else if (b > L)
      for (; b <= A; )
        Te(a[b], v, m, !0), b++;
    else {
      const D = b, K = b, Q = /* @__PURE__ */ new Map();
      for (b = K; b <= L; b++) {
        const _e = u[b] = C ? qe(u[b]) : Le(u[b]);
        _e.key != null && Q.set(_e.key, b);
      }
      let J, ie = 0;
      const le = L - K + 1;
      let Ae = !1, Pe = 0;
      const St = new Array(le);
      for (b = 0; b < le; b++) St[b] = 0;
      for (b = D; b <= A; b++) {
        const _e = a[b];
        if (ie >= le) {
          Te(_e, v, m, !0);
          continue;
        }
        let Ee;
        if (_e.key != null)
          Ee = Q.get(_e.key);
        else
          for (J = K; J <= L; J++)
            if (St[J - K] === 0 && wt(_e, u[J])) {
              Ee = J;
              break;
            }
        Ee === void 0 ? Te(_e, v, m, !0) : (St[Ee - K] = b + 1, Ee >= Pe ? Pe = Ee : Ae = !0, H(
          _e,
          u[Ee],
          h,
          null,
          v,
          m,
          k,
          w,
          C
        ), ie++);
      }
      const rs = Ae ? Bl(St) : ht;
      for (J = rs.length - 1, b = le - 1; b >= 0; b--) {
        const _e = K + b, Ee = u[_e], as = u[_e + 1], cs = _e + 1 < R ? (
          // #13559, #14173 fallback to el placeholder for unresolved async component
          as.el || $i(as)
        ) : y;
        St[b] === 0 ? H(
          null,
          Ee,
          h,
          cs,
          v,
          m,
          k,
          w,
          C
        ) : Ae && (J < 0 || b !== rs[J] ? nt(Ee, h, cs, 2) : J--);
      }
    }
  }, nt = (a, u, h, y, v = null) => {
    const { el: m, type: k, transition: w, children: C, shapeFlag: b } = a;
    if (b & 6) {
      nt(a.component.subTree, u, h, y);
      return;
    }
    if (b & 128) {
      a.suspense.move(u, h, y);
      return;
    }
    if (b & 64) {
      k.move(a, u, h, xt);
      return;
    }
    if (k === ee) {
      s(m, u, h);
      for (let A = 0; A < C.length; A++)
        nt(C[A], u, h, y);
      s(a.anchor, u, h);
      return;
    }
    if (k === Qt) {
      O(a, u, h);
      return;
    }
    if (y !== 2 && b & 1 && w)
      if (y === 0)
        w.beforeEnter(m), s(m, u, h), he(() => w.enter(m), v);
      else {
        const { leave: A, delayLeave: L, afterLeave: D } = w, K = () => {
          a.ctx.isUnmounted ? i(m) : s(m, u, h);
        }, Q = () => {
          m._isLeaving && m[nl](
            !0
            /* cancelled */
          ), A(m, () => {
            K(), D && D();
          });
        };
        L ? L(m, K, Q) : Q();
      }
    else
      s(m, u, h);
  }, Te = (a, u, h, y = !1, v = !1) => {
    const {
      type: m,
      props: k,
      ref: w,
      children: C,
      dynamicChildren: b,
      shapeFlag: R,
      patchFlag: A,
      dirs: L,
      cacheIndex: D,
      memo: K
    } = a;
    if (A === -2 && (v = !1), w != null && (Ve(), Mt(w, null, h, a, !0), Ge()), D != null && (u.renderCache[D] = void 0), R & 256) {
      u.ctx.deactivate(a);
      return;
    }
    const Q = R & 1 && L, J = !It(a);
    let ie;
    if (J && (ie = k && k.onVnodeBeforeUnmount) && Me(ie, u, a), R & 6)
      eo(a.component, h, y);
    else {
      if (R & 128) {
        a.suspense.unmount(h, y);
        return;
      }
      Q && st(a, null, u, "beforeUnmount"), R & 64 ? a.type.remove(
        a,
        u,
        h,
        xt,
        y
      ) : b && // #5154
      // when v-once is used inside a block, setBlockTracking(-1) marks the
      // parent block with hasOnce: true
      // so that it doesn't take the fast path during unmount - otherwise
      // components nested in v-once are never unmounted.
      !b.hasOnce && // #1153: fast path should not be taken for non-stable (v-for) fragments
      (m !== ee || A > 0 && A & 64) ? yt(
        b,
        u,
        h,
        !1,
        !0
      ) : (m === ee && A & 384 || !v && R & 16) && yt(C, u, h), y && os(a);
    }
    const le = K != null && D == null;
    (J && (ie = k && k.onVnodeUnmounted) || Q || le) && he(() => {
      ie && Me(ie, u, a), Q && st(a, null, u, "unmounted"), le && (a.el = null);
    }, h);
  }, os = (a) => {
    const { type: u, el: h, anchor: y, transition: v } = a;
    if (u === ee) {
      zi(h, y);
      return;
    }
    if (u === Qt) {
      P(a);
      return;
    }
    const m = () => {
      i(h), v && !v.persisted && v.afterLeave && v.afterLeave();
    };
    if (a.shapeFlag & 1 && v && !v.persisted) {
      const { leave: k, delayLeave: w } = v, C = () => k(h, m);
      w ? w(a.el, m, C) : C();
    } else
      m();
  }, zi = (a, u) => {
    let h;
    for (; a !== u; )
      h = S(a), i(a), a = h;
    i(u);
  }, eo = (a, u, h) => {
    const { bum: y, scope: v, job: m, subTree: k, um: w, m: C, a: b } = a;
    ws(C), ws(b), y && hn(y), v.stop(), m && (m.flags |= 8, Te(k, a, u, h)), w && he(w, u), he(() => {
      a.isUnmounted = !0;
    }, u);
  }, yt = (a, u, h, y = !1, v = !1, m = 0) => {
    for (let k = m; k < a.length; k++)
      Te(a[k], u, h, y, v);
  }, Kt = (a) => {
    if (a.shapeFlag & 6)
      return Kt(a.component.subTree);
    if (a.shapeFlag & 128)
      return a.suspense.next();
    const u = S(a.anchor || a.el), h = u && u[el];
    return h ? S(h) : u;
  };
  let dn = !1;
  const ls = (a, u, h) => {
    let y;
    a == null ? u._vnode && (Te(u._vnode, null, null, !0), y = u._vnode.component) : H(
      u._vnode || null,
      a,
      u,
      null,
      null,
      null,
      h
    ), u._vnode = a, dn || (dn = !0, hs(y), gi(), dn = !1);
  }, xt = {
    p: H,
    um: Te,
    m: nt,
    r: os,
    mt: g,
    mc: Se,
    pc: Z,
    pbc: ge,
    n: Kt,
    o: e
  };
  return {
    render: ls,
    hydrate: void 0,
    createApp: xl(ls)
  };
}
function xn({ type: e, props: t }, n) {
  return n === "svg" && e === "foreignObject" || n === "mathml" && e === "annotation-xml" && t && t.encoding && t.encoding.includes("html") ? void 0 : n;
}
function it({ effect: e, job: t }, n) {
  n ? (e.flags |= 32, t.flags |= 4) : (e.flags &= -33, t.flags &= -5);
}
function Fl(e, t) {
  return (!e || e && !e.pendingBranch) && t && !t.persisted;
}
function Ni(e, t, n = !1) {
  const s = e.children, i = t.children;
  if (F(s) && F(i))
    for (let o = 0; o < s.length; o++) {
      const l = s[o];
      let r = i[o];
      r.shapeFlag & 1 && !r.dynamicChildren && ((r.patchFlag <= 0 || r.patchFlag === 32) && (r = i[o] = qe(i[o]), r.el = l.el), !n && r.patchFlag !== -2 && Ni(l, r)), r.type === fn && (r.patchFlag === -1 && (r = i[o] = qe(r)), r.el = l.el), r.type === ze && !r.el && (r.el = l.el);
    }
}
function Bl(e) {
  const t = e.slice(), n = [0];
  let s, i, o, l, r;
  const c = e.length;
  for (s = 0; s < c; s++) {
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
function ji(e) {
  const t = e.subTree.component;
  if (t)
    return t.asyncDep && !t.asyncResolved ? t : ji(t);
}
function ws(e) {
  if (e)
    for (let t = 0; t < e.length; t++)
      e[t].flags |= 8;
}
function $i(e) {
  if (e.placeholder)
    return e.placeholder;
  const t = e.component;
  return t ? $i(t.subTree) : null;
}
const Ui = (e) => e.__isSuspense;
function Nl(e, t) {
  t && t.pendingBranch ? F(e) ? t.effects.push(...e) : t.effects.push(e) : Qo(e);
}
const ee = /* @__PURE__ */ Symbol.for("v-fgt"), fn = /* @__PURE__ */ Symbol.for("v-txt"), ze = /* @__PURE__ */ Symbol.for("v-cmt"), Qt = /* @__PURE__ */ Symbol.for("v-stc"), Lt = [];
let me = null;
function B(e = !1) {
  Lt.push(me = e ? null : []);
}
function jl() {
  Lt.pop(), me = Lt[Lt.length - 1] || null;
}
let Ft = 1;
function ks(e, t = !1) {
  Ft += e, e < 0 && me && t && (me.hasOnce = !0);
}
function Ki(e) {
  return e.dynamicChildren = Ft > 0 ? me || ht : null, jl(), Ft > 0 && me && me.push(e), e;
}
function N(e, t, n, s, i, o) {
  return Ki(
    f(
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
function $l(e, t, n, s, i) {
  return Ki(
    Fe(
      e,
      t,
      n,
      s,
      i,
      !0
    )
  );
}
function qi(e) {
  return e ? e.__v_isVNode === !0 : !1;
}
function wt(e, t) {
  return e.type === t.type && e.key === t.key;
}
const Wi = ({ key: e }) => e ?? null, Xt = ({
  ref: e,
  ref_key: t,
  ref_for: n
}) => (typeof e == "number" && (e = "" + e), e != null ? se(e) || /* @__PURE__ */ ce(e) || j(e) ? { i: De, r: e, k: t, f: !!n } : e : null);
function f(e, t = null, n = null, s = 0, i = null, o = e === ee ? 0 : 1, l = !1, r = !1) {
  const c = {
    __v_isVNode: !0,
    __v_skip: !0,
    type: e,
    props: t,
    key: t && Wi(t),
    ref: t && Xt(t),
    scopeId: vi,
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
    ctx: De
  };
  return r ? (zn(c, n), o & 128 && e.normalize(c)) : n && (c.shapeFlag |= se(n) ? 8 : 16), Ft > 0 && // avoid a block node from tracking itself
  !l && // has current parent block
  me && // presence of a patch flag indicates this node needs patching on updates.
  // component nodes also should always be patched, because even if the
  // component doesn't need to update, it needs to persist the instance on to
  // the next vnode so that it can be properly unmounted later.
  (c.patchFlag > 0 || o & 6) && // the EVENTS flag is only for hydration and if it is the only flag, the
  // vnode should not be considered dynamic due to handler caching.
  c.patchFlag !== 32 && me.push(c), c;
}
const Fe = Ul;
function Ul(e, t = null, n = null, s = 0, i = null, o = !1) {
  if ((!e || e === pl) && (e = ze), qi(e)) {
    const r = bt(
      e,
      t,
      !0
      /* mergeRef: true */
    );
    return n && zn(r, n), Ft > 0 && !o && me && (r.shapeFlag & 6 ? me[me.indexOf(e)] = r : me.push(r)), r.patchFlag = -2, r;
  }
  if (er(e) && (e = e.__vccOpts), t) {
    t = Kl(t);
    let { class: r, style: c } = t;
    r && !se(r) && (t.class = oe(r)), G(c) && (/* @__PURE__ */ Qn(c) && !F(c) && (c = ue({}, c)), t.style = Nn(c));
  }
  const l = se(e) ? 1 : Ui(e) ? 128 : tl(e) ? 64 : G(e) ? 4 : j(e) ? 2 : 0;
  return f(
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
  return e ? /* @__PURE__ */ Qn(e) || Li(e) ? ue({}, e) : e : null;
}
function bt(e, t, n = !1, s = !1) {
  const { props: i, ref: o, patchFlag: l, children: r, transition: c } = e, p = t ? Wl(i || {}, t) : i, d = {
    __v_isVNode: !0,
    __v_skip: !0,
    type: e.type,
    props: p,
    key: p && Wi(p),
    ref: t && t.ref ? (
      // #2078 in the case of <component :is="vnode" ref="extra"/>
      // if the vnode itself already has a ref, cloneVNode will need to merge
      // the refs so the single vnode can be set on multiple refs
      n && o ? F(o) ? o.concat(Xt(t)) : [o, Xt(t)] : Xt(t)
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
    patchFlag: t && e.type !== ee ? l === -1 ? 16 : l | 16 : l,
    dynamicProps: e.dynamicProps,
    dynamicChildren: e.dynamicChildren,
    appContext: e.appContext,
    dirs: e.dirs,
    transition: c,
    // These should technically only be non-null on mounted VNodes. However,
    // they *should* be copied for kept-alive vnodes. So we just always copy
    // them since them being non-null during a mount doesn't affect the logic as
    // they will simply be overwritten.
    component: e.component,
    suspense: e.suspense,
    ssContent: e.ssContent && bt(e.ssContent),
    ssFallback: e.ssFallback && bt(e.ssFallback),
    placeholder: e.placeholder,
    el: e.el,
    anchor: e.anchor,
    ctx: e.ctx,
    ce: e.ce
  };
  return c && s && Zn(
    d,
    c.clone(d)
  ), d;
}
function ql(e = " ", t = 0) {
  return Fe(fn, null, e, t);
}
function Ts(e, t) {
  const n = Fe(Qt, null, e);
  return n.staticCount = t, n;
}
function $e(e = "", t = !1) {
  return t ? (B(), $l(ze, null, e)) : Fe(ze, null, e);
}
function Le(e) {
  return e == null || typeof e == "boolean" ? Fe(ze) : F(e) ? Fe(
    ee,
    null,
    // #3666, avoid reference pollution when reusing vnode
    e.slice()
  ) : qi(e) ? qe(e) : Fe(fn, null, String(e));
}
function qe(e) {
  return e.el === null && e.patchFlag !== -1 || e.memo ? e : bt(e);
}
function zn(e, t) {
  let n = 0;
  const { shapeFlag: s } = e;
  if (t == null)
    t = null;
  else if (F(t))
    n = 16;
  else if (typeof t == "object")
    if (s & 65) {
      const i = t.default;
      i && (i._c && (i._d = !1), zn(e, i()), i._c && (i._d = !0));
      return;
    } else {
      n = 32;
      const i = t._;
      !i && !Li(t) ? t._ctx = De : i === 3 && De && (De.slots._ === 1 ? t._ = 1 : (t._ = 2, e.patchFlag |= 1024));
    }
  else j(t) ? (t = { default: t, _ctx: De }, n = 32) : (t = String(t), s & 64 ? (n = 16, t = [ql(t)]) : n = 8);
  e.children = t, e.shapeFlag |= n;
}
function Wl(...e) {
  const t = {};
  for (let n = 0; n < e.length; n++) {
    const s = e[n];
    for (const i in s)
      if (i === "class")
        t.class !== s.class && (t.class = oe([t.class, s.class]));
      else if (i === "style")
        t.style = Nn([t.style, s.style]);
      else if (nn(i)) {
        const o = t[i], l = s[i];
        l && o !== l && !(F(o) && o.includes(l)) ? t[i] = o ? [].concat(o, l) : l : l == null && o == null && // mergeProps({ 'onUpdate:modelValue': undefined }) should not retain
        // the model listener.
        !sn(i) && (t[i] = l);
      } else i !== "" && (t[i] = s[i]);
  }
  return t;
}
function Me(e, t, n, s = null) {
  Ne(e, t, 7, [
    n,
    s
  ]);
}
const Vl = Pi();
let Gl = 0;
function Ql(e, t, n) {
  const s = e.type, i = (t ? t.appContext : e.appContext) || Vl, o = {
    uid: Gl++,
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
    scope: new ho(
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
    propsOptions: Di(s, i),
    emitsOptions: Ei(s, i),
    // emit
    emit: null,
    // to be set immediately
    emitted: null,
    // props default value
    propsDefaults: z,
    // inheritAttrs
    inheritAttrs: s.inheritAttrs,
    // state
    ctx: z,
    data: z,
    props: z,
    attrs: z,
    slots: z,
    refs: z,
    setupState: z,
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
let pe = null;
const Xl = () => pe || De;
let tn, Ln;
{
  const e = ln(), t = (n, s) => {
    let i;
    return (i = e[n]) || (i = e[n] = []), i.push(s), (o) => {
      i.length > 1 ? i.forEach((l) => l(o)) : i[0](o);
    };
  };
  tn = t(
    "__VUE_INSTANCE_SETTERS__",
    (n) => pe = n
  ), Ln = t(
    "__VUE_SSR_SETTERS__",
    (n) => Bt = n
  );
}
const $t = (e) => {
  const t = pe;
  return tn(e), e.scope.on(), () => {
    e.scope.off(), tn(t);
  };
}, As = () => {
  pe && pe.scope.off(), tn(null);
};
function Vi(e) {
  return e.vnode.shapeFlag & 4;
}
let Bt = !1;
function Zl(e, t = !1, n = !1) {
  t && Ln(t);
  const { props: s, children: i } = e.vnode, o = Vi(e);
  El(e, s, o, t), Ll(e, i, n || t);
  const l = o ? Jl(e, t) : void 0;
  return t && Ln(!1), l;
}
function Jl(e, t) {
  const n = e.type;
  e.accessCache = /* @__PURE__ */ Object.create(null), e.proxy = new Proxy(e.ctx, hl);
  const { setup: s } = n;
  if (s) {
    Ve();
    const i = e.setupContext = s.length > 1 ? zl(e) : null, o = $t(e), l = jt(
      s,
      e,
      0,
      [
        e.props,
        i
      ]
    ), r = qs(l);
    if (Ge(), o(), (r || e.sp) && !It(e) && yi(e), r) {
      if (l.then(As, As), t)
        return l.then((c) => {
          Ps(e, c);
        }).catch((c) => {
          an(c, e, 0);
        });
      e.asyncDep = l;
    } else
      Ps(e, l);
  } else
    Gi(e);
}
function Ps(e, t, n) {
  j(t) ? e.type.__ssrInlineRender ? e.ssrRender = t : e.render = t : G(t) && (e.setupState = di(t)), Gi(e);
}
function Gi(e, t, n) {
  const s = e.type;
  e.render || (e.render = s.render || He);
  {
    const i = $t(e);
    Ve();
    try {
      gl(e);
    } finally {
      Ge(), i();
    }
  }
}
const Yl = {
  get(e, t) {
    return ae(e, "get", ""), e[t];
  }
};
function zl(e) {
  const t = (n) => {
    e.exposed = n || {};
  };
  return {
    attrs: new Proxy(e.attrs, Yl),
    slots: e.slots,
    emit: e.emit,
    expose: t
  };
}
function es(e) {
  return e.exposed ? e.exposeProxy || (e.exposeProxy = new Proxy(di(Do(e.exposed)), {
    get(t, n) {
      if (n in t)
        return t[n];
      if (n in Ot)
        return Ot[n](e);
    },
    has(t, n) {
      return n in t || n in Ot;
    }
  })) : e.proxy;
}
function er(e) {
  return j(e) && "__vccOpts" in e;
}
const ve = (e, t) => /* @__PURE__ */ Uo(e, t, Bt), tr = "3.5.34";
let Rn;
const Es = typeof window < "u" && window.trustedTypes;
if (Es)
  try {
    Rn = /* @__PURE__ */ Es.createPolicy("vue", {
      createHTML: (e) => e
    });
  } catch {
  }
const Qi = Rn ? (e) => Rn.createHTML(e) : (e) => e, nr = "http://www.w3.org/2000/svg", sr = "http://www.w3.org/1998/Math/MathML", Ue = typeof document < "u" ? document : null, Ms = Ue && /* @__PURE__ */ Ue.createElement("template"), ir = {
  insert: (e, t, n) => {
    t.insertBefore(e, n || null);
  },
  remove: (e) => {
    const t = e.parentNode;
    t && t.removeChild(e);
  },
  createElement: (e, t, n, s) => {
    const i = t === "svg" ? Ue.createElementNS(nr, e) : t === "mathml" ? Ue.createElementNS(sr, e) : n ? Ue.createElement(e, { is: n }) : Ue.createElement(e);
    return e === "select" && s && s.multiple != null && i.setAttribute("multiple", s.multiple), i;
  },
  createText: (e) => Ue.createTextNode(e),
  createComment: (e) => Ue.createComment(e),
  setText: (e, t) => {
    e.nodeValue = t;
  },
  setElementText: (e, t) => {
    e.textContent = t;
  },
  parentNode: (e) => e.parentNode,
  nextSibling: (e) => e.nextSibling,
  querySelector: (e) => Ue.querySelector(e),
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
      Ms.innerHTML = Qi(
        s === "svg" ? `<svg>${e}</svg>` : s === "mathml" ? `<math>${e}</math>` : e
      );
      const r = Ms.content;
      if (s === "svg" || s === "mathml") {
        const c = r.firstChild;
        for (; c.firstChild; )
          r.appendChild(c.firstChild);
        r.removeChild(c);
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
}, or = /* @__PURE__ */ Symbol("_vtc");
function lr(e, t, n) {
  const s = e[or];
  s && (t = (t ? [t, ...s] : [...s]).join(" ")), t == null ? e.removeAttribute("class") : n ? e.setAttribute("class", t) : e.className = t;
}
const Is = /* @__PURE__ */ Symbol("_vod"), rr = /* @__PURE__ */ Symbol("_vsh"), ar = /* @__PURE__ */ Symbol(""), cr = /(?:^|;)\s*display\s*:/;
function ur(e, t, n) {
  const s = e.style, i = se(n);
  let o = !1;
  if (n && !i) {
    if (t)
      if (se(t))
        for (const l of t.split(";")) {
          const r = l.slice(0, l.indexOf(":")).trim();
          n[r] == null && Tt(s, r, "");
        }
      else
        for (const l in t)
          n[l] == null && Tt(s, l, "");
    for (const l in n) {
      l === "display" && (o = !0);
      const r = n[l];
      r != null ? dr(
        e,
        l,
        !se(t) && t ? t[l] : void 0,
        r
      ) || Tt(s, l, r) : Tt(s, l, "");
    }
  } else if (i) {
    if (t !== n) {
      const l = s[ar];
      l && (n += ";" + l), s.cssText = n, o = cr.test(n);
    }
  } else t && e.removeAttribute("style");
  Is in e && (e[Is] = o ? s.display : "", e[rr] && (s.display = "none"));
}
const Os = /\s*!important$/;
function Tt(e, t, n) {
  if (F(n))
    n.forEach((s) => Tt(e, t, s));
  else if (n == null && (n = ""), t.startsWith("--"))
    e.setProperty(t, n);
  else {
    const s = fr(e, t);
    Os.test(n) ? e.setProperty(
      at(s),
      n.replace(Os, ""),
      "important"
    ) : e[s] = n;
  }
}
const Ls = ["Webkit", "Moz", "ms"], Sn = {};
function fr(e, t) {
  const n = Sn[t];
  if (n)
    return n;
  let s = Ce(t);
  if (s !== "filter" && s in e)
    return Sn[t] = s;
  s = Gs(s);
  for (let i = 0; i < Ls.length; i++) {
    const o = Ls[i] + s;
    if (o in e)
      return Sn[t] = o;
  }
  return t;
}
function dr(e, t, n, s) {
  return e.tagName === "TEXTAREA" && (t === "width" || t === "height") && se(s) && n === s;
}
const Rs = "http://www.w3.org/1999/xlink";
function Ds(e, t, n, s, i, o = fo(t)) {
  s && t.startsWith("xlink:") ? n == null ? e.removeAttributeNS(Rs, t.slice(6, t.length)) : e.setAttributeNS(Rs, t, n) : n == null || o && !Xs(n) ? e.removeAttribute(t) : e.setAttribute(
    t,
    o ? "" : Be(n) ? String(n) : n
  );
}
function Hs(e, t, n, s, i) {
  if (t === "innerHTML" || t === "textContent") {
    n != null && (e[t] = t === "innerHTML" ? Qi(n) : n);
    return;
  }
  const o = e.tagName;
  if (t === "value" && o !== "PROGRESS" && // custom elements may use _value internally
  !o.includes("-")) {
    const r = o === "OPTION" ? e.getAttribute("value") || "" : e.value, c = n == null ? (
      // #11647: value should be set as empty string for null and undefined,
      // but <input type="checkbox"> should be set as 'on'.
      e.type === "checkbox" ? "on" : ""
    ) : String(n);
    (r !== c || !("_value" in e)) && (e.value = c), n == null && e.removeAttribute(t), e._value = n;
    return;
  }
  let l = !1;
  if (n === "" || n == null) {
    const r = typeof e[t];
    r === "boolean" ? n = Xs(n) : n == null && r === "string" ? (n = "", l = !0) : r === "number" && (n = 0, l = !0);
  }
  try {
    e[t] = n;
  } catch {
  }
  l && e.removeAttribute(i || t);
}
function pr(e, t, n, s) {
  e.addEventListener(t, n, s);
}
function hr(e, t, n, s) {
  e.removeEventListener(t, n, s);
}
const Fs = /* @__PURE__ */ Symbol("_vei");
function gr(e, t, n, s, i = null) {
  const o = e[Fs] || (e[Fs] = {}), l = o[t];
  if (s && l)
    l.value = s;
  else {
    const [r, c] = _r(t);
    if (s) {
      const p = o[t] = br(
        s,
        i
      );
      pr(e, r, p, c);
    } else l && (hr(e, r, l, c), o[t] = void 0);
  }
}
const Bs = /(?:Once|Passive|Capture)$/;
function _r(e) {
  let t;
  if (Bs.test(e)) {
    t = {};
    let s;
    for (; s = e.match(Bs); )
      e = e.slice(0, e.length - s[0].length), t[s[0].toLowerCase()] = !0;
  }
  return [e[2] === ":" ? e.slice(3) : at(e.slice(2)), t];
}
let Cn = 0;
const vr = /* @__PURE__ */ Promise.resolve(), mr = () => Cn || (vr.then(() => Cn = 0), Cn = Date.now());
function br(e, t) {
  const n = (s) => {
    if (!s._vts)
      s._vts = Date.now();
    else if (s._vts <= n.attached)
      return;
    Ne(
      yr(s, n.value),
      t,
      5,
      [s]
    );
  };
  return n.value = e, n.attached = mr(), n;
}
function yr(e, t) {
  if (F(t)) {
    const n = e.stopImmediatePropagation;
    return e.stopImmediatePropagation = () => {
      n.call(e), e._stopped = !0;
    }, t.map(
      (s) => (i) => !i._stopped && s && s(i)
    );
  } else
    return t;
}
const Ns = (e) => e.charCodeAt(0) === 111 && e.charCodeAt(1) === 110 && // lowercase letter
e.charCodeAt(2) > 96 && e.charCodeAt(2) < 123, xr = (e, t, n, s, i, o) => {
  const l = i === "svg";
  t === "class" ? lr(e, s, l) : t === "style" ? ur(e, n, s) : nn(t) ? sn(t) || gr(e, t, n, s, o) : (t[0] === "." ? (t = t.slice(1), !0) : t[0] === "^" ? (t = t.slice(1), !1) : Sr(e, t, s, l)) ? (Hs(e, t, s), !e.tagName.includes("-") && (t === "value" || t === "checked" || t === "selected") && Ds(e, t, s, l, o, t !== "value")) : /* #11081 force set props for possible async custom element */ e._isVueCE && // #12408 check if it's declared prop or it's async custom element
  (Cr(e, t) || // @ts-expect-error _def is private
  e._def.__asyncLoader && (/[A-Z]/.test(t) || !se(s))) ? Hs(e, Ce(t), s, o, t) : (t === "true-value" ? e._trueValue = s : t === "false-value" && (e._falseValue = s), Ds(e, t, s, l));
};
function Sr(e, t, n, s) {
  if (s)
    return !!(t === "innerHTML" || t === "textContent" || t in e && Ns(t) && j(n));
  if (t === "spellcheck" || t === "draggable" || t === "translate" || t === "autocorrect" || t === "sandbox" && e.tagName === "IFRAME" || t === "form" || t === "list" && e.tagName === "INPUT" || t === "type" && e.tagName === "TEXTAREA")
    return !1;
  if (t === "width" || t === "height") {
    const i = e.tagName;
    if (i === "IMG" || i === "VIDEO" || i === "CANVAS" || i === "SOURCE")
      return !1;
  }
  return Ns(t) && se(n) ? !1 : t in e;
}
function Cr(e, t) {
  const n = (
    // @ts-expect-error _def is private
    e._def.props
  );
  if (!n)
    return !1;
  const s = Ce(t);
  return Array.isArray(n) ? n.some((i) => Ce(i) === s) : Object.keys(n).some((i) => Ce(i) === s);
}
const wr = ["ctrl", "shift", "alt", "meta"], kr = {
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
  exact: (e, t) => wr.some((n) => e[`${n}Key`] && !t.includes(n))
}, Tr = (e, t) => {
  if (!e) return e;
  const n = e._withMods || (e._withMods = {}), s = t.join(".");
  return n[s] || (n[s] = ((i, ...o) => {
    for (let l = 0; l < t.length; l++) {
      const r = kr[t[l]];
      if (r && r(i, t)) return;
    }
    return e(i, ...o);
  }));
}, Ar = /* @__PURE__ */ ue({ patchProp: xr }, ir);
let js;
function Pr() {
  return js || (js = Dl(Ar));
}
const Er = ((...e) => {
  const t = Pr().createApp(...e), { mount: n } = t;
  return t.mount = (s) => {
    const i = Ir(s);
    if (!i) return;
    const o = t._component;
    !j(o) && !o.render && !o.template && (o.template = i.innerHTML), i.nodeType === 1 && (i.textContent = "");
    const l = n(i, !1, Mr(i));
    return i instanceof Element && (i.removeAttribute("v-cloak"), i.setAttribute("data-v-app", "")), l;
  }, t;
});
function Mr(e) {
  if (e instanceof SVGElement)
    return "svg";
  if (typeof MathMLElement == "function" && e instanceof MathMLElement)
    return "mathml";
}
function Ir(e) {
  return se(e) ? document.querySelector(e) : e;
}
function Ze() {
  return typeof window < "u" && window.openxnetApp || null;
}
function Or(e) {
  if (e && typeof e.isCurrentLanguageZh == "function")
    try {
      return !!e.isCurrentLanguageZh();
    } catch {
      return !0;
    }
  return String(e?.currentLanguage || navigator.language || "zh-CN").toLowerCase().startsWith("zh");
}
function ts(e, t) {
  if (!t) return "";
  if (e && typeof e.t == "function")
    try {
      return e.t(t.title) || t.label || t.id || "";
    } catch {
      return t.label || t.id || "";
    }
  return t.label || t.id || "";
}
const Lr = {
  "toolkit-builtin": "green",
  "toolkit-assets": "purple",
  "toolkit-custom": "orange",
  "toolkit-integrations": "blue",
  "toolkit-protocol": "accent",
  "toolkit-workbench": "gray"
}, ns = {
  websearch: "green",
  interpreter: "green",
  CLI: "green",
  document: "purple",
  sticker: "pink",
  llmTool: "orange",
  customHttpTool: "orange",
  HA: "blue",
  chromeMCP: "blue",
  sql: "blue",
  comfyui: "blue",
  mcp: "accent",
  a2a: "accent"
}, ss = {
  sticker: "stickerButton",
  llmTool: "llmButton",
  customHttpTool: "httpButton",
  mcp: "mcpButton",
  a2a: "a2aButton",
  comfyui: "comfyuiButton"
};
function Xi(e, t) {
  if (!t) return [];
  const n = /* @__PURE__ */ new Set(), s = [];
  return [
    e?.MoreButtonDict,
    e?.largeMoreButtonDict,
    e?.smallMoreButtonDict
  ].forEach((i) => {
    Array.isArray(i) && i.forEach((o) => {
      !o || o.name !== t || n.has(o) || (n.add(o), s.push(o));
    });
  }), s;
}
function Zi(e, t) {
  return Xi(e, t)[0] || null;
}
function Rr(e, t) {
  const n = String(t || "").trim();
  return ["websearch", "interpreter", "CLI", "document", "HA", "chromeMCP", "sql"].includes(n) ? !0 : !!Zi(e, ss[n]);
}
function Ke(e, t) {
  const n = String(t || "").trim();
  switch (n) {
    case "websearch":
      return !!e?.webSearchSettings?.enabled;
    case "interpreter":
      return !!e?.codeSettings?.enabled;
    case "CLI":
      return !!e?.CLISettings?.enabled;
    case "document":
      return typeof e?.KBSettings?.enabled == "boolean" ? !!e.KBSettings.enabled : Array.isArray(e?.knowledgeBases) ? e.knowledgeBases.some((s) => s && s.enabled !== !1) : !1;
    case "HA":
      return !!e?.HASettings?.enabled;
    case "chromeMCP":
      return !!e?.chromeMCPSettings?.enabled;
    case "sql":
      return !!e?.sqlSettings?.enabled;
    default:
      return !!Zi(e, ss[n])?.enabled;
  }
}
function is(e, t) {
  const n = String(t || "").trim(), s = {
    websearch: e?.webSearchSettings?.enabled,
    interpreter: e?.codeSettings?.enabled,
    CLI: e?.CLISettings?.enabled,
    HA: e?.HASettings?.enabled,
    chromeMCP: e?.chromeMCPSettings?.enabled,
    sql: e?.sqlSettings?.enabled
  };
  return typeof s[n] == "boolean" ? s[n] ? "running" : "installed" : n === "document" ? Array.isArray(e?.knowledgeBases) && e.knowledgeBases.length > 0 ? "running" : "installed" : n === "comfyui" ? Array.isArray(e?.comfyuiServers) && e.comfyuiServers.length > 0 ? "running" : "installed" : n === "mcp" ? Object.keys(e?.mcpServers || {}).length > 0 ? "running" : "installed" : n === "a2a" ? Object.keys(e?.a2aServers || {}).length > 0 ? "running" : "installed" : n === "llmTool" ? Array.isArray(e?.llmTools) && e.llmTools.length > 0 ? "running" : "installed" : n === "customHttpTool" ? Array.isArray(e?.customHttpTools) && e.customHttpTools.length > 0 ? "running" : "installed" : n === "sticker" && Array.isArray(e?.stickerPacks) && e.stickerPacks.length > 0 ? "running" : "installed";
}
function Ji(e, t, n, s) {
  if (e && typeof e.getPrototypeToolkitStatusLabel == "function")
    try {
      const i = e.getPrototypeToolkitStatusLabel(n);
      if (i) return i;
    } catch {
    }
  return t === "running" ? s ? "运行中" : "Running" : t === "not-installed" ? s ? "未安装" : "Not installed" : s ? "已安装" : "Installed";
}
function Yi(e, t, n) {
  const s = String(t || "").trim(), i = n ? {
    websearch: "DuckDuckGo / Tavily / SearXNG 搜索链路统一入口",
    interpreter: "代码执行、沙箱与计算型推理",
    CLI: "本地、Docker、Claude Code、Codex、Qwen 环境",
    document: "向量库检索、重排与知识工作流",
    sticker: "贴纸 / 角色素材 / 图像资源",
    llmTool: "自定义模型侧工具入口",
    customHttpTool: "自定义 HTTP/REST 接口工具",
    HA: "Home Assistant 智能家居自动化",
    chromeMCP: "内置浏览器与 Browser MCP / Playwright",
    sql: "SQLite / MySQL / Postgres 结构化查询",
    comfyui: "ComfyUI 节点工作流与图像生成",
    mcp: "Model Context Protocol 服务管理",
    a2a: "Agent-to-Agent 协同节点"
  } : {
    websearch: "DuckDuckGo / Tavily / SearXNG search routes",
    interpreter: "Code execution, sandbox & compute reasoning",
    CLI: "Local, Docker, Claude Code, Codex, Qwen runtimes",
    document: "Vector retrieval, reranking and knowledge flow",
    sticker: "Stickers, role assets & media resources",
    llmTool: "Custom model-side tool surface",
    customHttpTool: "Custom HTTP/REST tool surface",
    HA: "Home Assistant smart home automation",
    chromeMCP: "Internal browser + Browser MCP / Playwright",
    sql: "SQLite / MySQL / Postgres structured queries",
    comfyui: "ComfyUI workflow & image generation",
    mcp: "Model Context Protocol service manager",
    a2a: "Agent-to-Agent collaboration nodes"
  };
  if (i[s]) return i[s];
  if (e && typeof e.getPrototypeToolkitDetailMeta == "function")
    try {
      const o = e.getPrototypeToolkitDetailMeta(s);
      if (o?.summary) return String(o.summary);
    } catch {
    }
  return n ? "此工具尚未提供描述。" : "No description available yet.";
}
function Dr(e, t) {
  const n = String(e || "").trim(), i = {
    websearch: {
      introZh: "联网搜索为实时对话、研究和资料核验提供外部检索能力，可选择 DuckDuckGo、Tavily、SearXNG 等搜索链路。",
      introEn: "Web search adds external retrieval to live chat, research, and fact checking with engines such as DuckDuckGo, Tavily, and SearXNG.",
      setupZh: ["选择搜索引擎和网页抓取器。", "需要 API Key 的服务先在对应服务商官网创建密钥。", "设置注入时机，决定搜索结果在模型推理前还是推理后进入上下文。"],
      setupEn: ["Choose a search engine and crawler.", "Create API keys on vendor sites when the service requires one.", "Set when retrieved content is injected into the model context."],
      links: [
        { label: "Tavily", url: "https://tavily.com/" },
        { label: "SearXNG", url: "https://docs.searxng.org/" },
        { label: "DuckDuckGo", url: "https://duckduckgo.com/" }
      ]
    },
    interpreter: {
      introZh: "代码解释器让模型可以执行代码、计算数据和处理文件，适合分析、转换、绘图和自动化任务。",
      introEn: "The code interpreter lets the model run code, compute data, and process files for analysis, conversion, plotting, and automation.",
      setupZh: ["选择执行引擎。", "使用 E2B 时填写 API Key。", "使用自建沙箱时填写 Sandbox URL 并确认网络可访问。"],
      setupEn: ["Choose an execution engine.", "Fill the E2B API key when using E2B.", "For a self-hosted sandbox, enter the Sandbox URL and verify connectivity."],
      links: [
        { label: "E2B", url: "https://e2b.dev/" },
        { label: "Docker", url: "https://www.docker.com/" }
      ]
    },
    CLI: {
      introZh: "CLI 工具把本地工作区、Docker 沙箱和代码智能体连接到对话中，用于项目操作、文件修改和命令执行。",
      introEn: "CLI tools connect local workspaces, Docker sandboxes, and coding agents to chat for project operations, file edits, and command execution.",
      setupZh: ["选择 CLI 引擎。", "填写工作区路径。", "确认权限模式和可见范围，避免工具越界访问。"],
      setupEn: ["Select a CLI engine.", "Set the workspace path.", "Review permission mode and visibility scope to keep access bounded."],
      links: [
        { label: "Claude Code", url: "https://docs.anthropic.com/en/docs/claude-code" },
        { label: "OpenAI Codex", url: "https://openai.com/codex/" }
      ]
    },
    document: {
      introZh: "知识库工具把本地文档、向量检索和重排能力接入对话，让模型按需引用已有资料。",
      introEn: "Knowledge tools connect local documents, vector retrieval, and reranking so the model can cite existing material when needed.",
      setupZh: ["先在知识库菜单创建并启用知识库。", "设置返回片段数量。", "按需要开启重排并选择检索注入时机。"],
      setupEn: ["Create and enable knowledge bases in the Knowledge Base menu first.", "Set how many chunks are returned.", "Enable rerank and choose retrieval timing when needed."],
      links: [
        { label: "Qdrant", url: "https://qdrant.tech/" },
        { label: "Milvus", url: "https://milvus.io/" }
      ]
    },
    sticker: {
      introZh: "贴纸/图片库用于维护角色素材、表情包和图像资源，方便聊天与生成流程复用。",
      introEn: "Sticker and image libraries keep role assets, sticker packs, and media resources reusable across chat and generation workflows.",
      setupZh: ["导入贴纸包或图片素材。", "开启需要在聊天中使用的素材包。", "保持角色素材命名清晰，便于检索。"],
      setupEn: ["Import sticker packs or image assets.", "Enable packs that should be available in chat.", "Use clear names so assets are easy to retrieve."],
      links: [
        { label: "OpenXnet 素材库", url: "https://openxnet.synapxnet.com/" }
      ]
    },
    llmTool: {
      introZh: "LLM 工具用于注册模型侧工具入口，把自定义能力暴露给对话模型调用。",
      introEn: "LLM tools register model-side capabilities and expose custom functions to the chat model.",
      setupZh: ["创建工具名称和描述。", "填写 Base URL、API Key 和工具 schema。", "启用后在实时对话中测试调用。"],
      setupEn: ["Create a tool name and description.", "Fill Base URL, API key, and tool schema.", "Enable it and test calls in Live Chat."],
      links: [
        { label: "OpenAI Function Calling", url: "https://platform.openai.com/docs/guides/function-calling" }
      ]
    },
    customHttpTool: {
      introZh: "HTTP 工具把 REST 接口接入 OpenXnet，适合企业内部 API、Webhook 和自动化服务。",
      introEn: "HTTP tools connect REST endpoints to OpenXnet for internal APIs, webhooks, and automation services.",
      setupZh: ["填写接口地址、方法和请求头。", "配置参数模板和响应解析。", "用测试请求确认返回结构稳定。"],
      setupEn: ["Fill endpoint URL, method, and headers.", "Configure parameter templates and response parsing.", "Run a test request to verify the response shape."],
      links: [
        { label: "REST API", url: "https://restfulapi.net/" }
      ]
    },
    HA: {
      introZh: "Home Assistant 用于连接智能家居，实现设备状态读取、自动化触发和场景控制。",
      introEn: "Home Assistant connects smart-home devices for state lookup, automation triggers, and scene control.",
      setupZh: ["填写 Home Assistant 服务地址。", "在 Home Assistant 中创建长期访问令牌。", "保存后测试设备列表和自动化权限。"],
      setupEn: ["Enter the Home Assistant service URL.", "Create a long-lived access token in Home Assistant.", "Save and test device list and automation permissions."],
      links: [
        { label: "Home Assistant", url: "https://www.home-assistant.io/" }
      ]
    },
    chromeMCP: {
      introZh: "浏览器控制连接内置浏览器、外部 Browser MCP 或 Playwright，用于网页观察和自动化操作。",
      introEn: "Browser control connects the internal browser, external Browser MCP, or Playwright for web observation and automation.",
      setupZh: ["选择内置浏览器或外部 MCP。", "外部模式填写 MCP 名称和 CDP 端口。", "确认浏览器调试端口可用。"],
      setupEn: ["Choose internal browser or external MCP.", "For external mode, fill MCP name and CDP port.", "Verify that the browser debugging port is available."],
      links: [
        { label: "Playwright", url: "https://playwright.dev/" },
        { label: "Chrome DevTools Protocol", url: "https://chromedevtools.github.io/devtools-protocol/" }
      ]
    },
    sql: {
      introZh: "数据库工具为 SQLite、Postgres、MySQL 等结构化数据提供查询入口。",
      introEn: "Database tools provide structured-query access to SQLite, Postgres, MySQL, and related stores.",
      setupZh: ["选择数据库引擎。", "填写主机、端口、数据库名或本地 DB 路径。", "建议使用只读账号连接生产数据。"],
      setupEn: ["Choose the database engine.", "Fill host, port, database name, or local DB path.", "Use read-only accounts for production data whenever possible."],
      links: [
        { label: "SQLite", url: "https://sqlite.org/" },
        { label: "PostgreSQL", url: "https://www.postgresql.org/" },
        { label: "MySQL", url: "https://www.mysql.com/" }
      ]
    },
    comfyui: {
      introZh: "ComfyUI 让 OpenXnet 调用节点工作流、图像生成和图像处理服务。",
      introEn: "ComfyUI lets OpenXnet call node workflows for image generation and image processing.",
      setupZh: ["启动 ComfyUI 服务。", "确认服务地址，例如 127.0.0.1:8188。", "在 ComfyUI 中准备工作流和节点资源。"],
      setupEn: ["Start the ComfyUI service.", "Verify the service endpoint, for example 127.0.0.1:8188.", "Prepare workflows and node resources in ComfyUI."],
      links: [
        { label: "ComfyUI", url: "https://github.com/comfyanonymous/ComfyUI" },
        { label: "默认本地地址", url: "http://127.0.0.1:8188/" }
      ]
    },
    mcp: {
      introZh: "MCP 服务器把外部工具、文件系统、浏览器和业务系统以统一协议接入 OpenXnet。",
      introEn: "MCP servers connect external tools, filesystems, browsers, and business systems to OpenXnet through a common protocol.",
      setupZh: ["添加 MCP 服务配置。", "确认命令、环境变量和工具列表。", "启用后在实时对话里验证工具调用。"],
      setupEn: ["Add MCP server configuration.", "Review command, environment variables, and tool list.", "Enable and verify tool calls in Live Chat."],
      links: [
        { label: "Model Context Protocol", url: "https://modelcontextprotocol.io/" }
      ]
    },
    a2a: {
      introZh: "A2A 服务用于连接外部智能体节点，让多个智能体之间可以协作。",
      introEn: "A2A services connect external agent nodes so multiple agents can collaborate.",
      setupZh: ["添加 A2A 服务地址。", "检查节点状态和能力清单。", "在需要多智能体协作的任务中启用。"],
      setupEn: ["Add the A2A service endpoint.", "Check node status and capability list.", "Enable it for multi-agent collaboration tasks."],
      links: [
        { label: "A2A Protocol", url: "https://google.github.io/A2A/" }
      ]
    }
  }[n] || {
    introZh: "此工具提供 OpenXnet 扩展能力，配置后可在对话、自动化或工作流中使用。",
    introEn: "This tool extends OpenXnet and can be used in chat, automation, or workflows after configuration.",
    setupZh: ["打开对应配置项。", "填写必要地址、密钥或运行参数。", "保存后回到实时对话验证。"],
    setupEn: ["Open the matching configuration lane.", "Fill required endpoints, keys, or runtime parameters.", "Save and verify from Live Chat."],
    links: [{ label: "OpenXnet", url: "https://openxnet.synapxnet.com/" }]
  };
  return {
    intro: t ? i.introZh : i.introEn,
    setupSteps: t ? i.setupZh : i.setupEn,
    links: i.links || []
  };
}
function $s(e) {
  return "v1.0.0";
}
function Hr(e, t) {
  return e && typeof e.getPrototypeToolkitSubnavSections == "function" ? e.getPrototypeToolkitSubnavSections(e.toolkitTiles || []).map((n) => ({
    id: n.id,
    label: n.label || "",
    items: (n.items || []).filter((s) => s && s.id !== "tools").map((s) => {
      const i = String(s.id || ""), o = is(e, i);
      return {
        id: i,
        label: s.label || ts(e, s),
        icon: s.icon || "fa-solid fa-circle",
        targetMenu: s.targetMenu || "",
        targetSubMenu: s.targetSubMenu || "",
        status: o,
        iconColor: ns[i] || Lr[n.id] || "gray"
      };
    })
  })).filter((n) => n.items.length > 0) : [];
}
function Fr(e, t) {
  let n = [];
  if (Array.isArray(e?.toolkitTiles))
    n = e.toolkitTiles.filter((i) => i && String(i.id || "").trim() !== "tools");
  else if (e && typeof e.getPrototypeToolkitOverviewCards == "function")
    try {
      n = e.getPrototypeToolkitOverviewCards() || [];
    } catch {
      n = [];
    }
  const s = String(e?.toolkitOverviewQuery || "").trim().toLowerCase();
  return n.map((i) => {
    const o = String(i?.id || "").trim(), l = ts(e, i), r = is(e, o);
    return {
      id: o,
      label: l,
      description: Yi(e, o, t),
      icon: i.icon || "fa-solid fa-circle",
      iconColor: ns[o] || "gray",
      status: r,
      statusLabel: Ji(e, r, o, t),
      canToggle: Rr(e, o),
      enabled: Ke(e, o),
      toggleLabel: Ke(e, o) ? t ? "已开启" : "On" : t ? "已关闭" : "Off"
    };
  }).filter((i) => s ? `${i.label} ${i.id} ${i.description}`.toLowerCase().includes(s) : !0);
}
function Br(e, t, n) {
  if (!t || t === "tools")
    return {
      id: "tools",
      title: n ? "工具概览" : "Tool Overview",
      icon: "fa-solid fa-toolbox",
      iconColor: "accent",
      description: n ? "集中查看全部工具分类、启用状态和入口，点击任一细类后在中间填写配置，右侧查看说明和相关网站。" : "Review all tool categories, states, and entry points. Select a tool to configure it in the middle panel and read guidance on the right.",
      chips: [],
      status: "installed",
      statusLabel: n ? "总览" : "Overview",
      runtime: n ? "点击左侧细类或中间卡片进入配置。" : "Select a category or card to configure it.",
      runtimeMeta: n ? "概览中的开关会直接同步到对应工具状态。" : "Overview switches sync directly to each tool state.",
      version: $s(),
      guide: {
        intro: n ? "工具概览用于统一观察 OpenXnet 的工具能力：内置工具、知识素材、自定义工具、外部集成和协议服务。" : "Tool Overview is the control surface for built-in tools, knowledge assets, custom tools, integrations, and protocol services.",
        setupSteps: n ? ["先打开需要使用的工具开关。", "再进入具体工具填写地址、密钥或运行参数。", "最后回到实时对话验证工具调用效果。"] : ["Turn on the tools you need.", "Open a specific tool and fill endpoints, keys, or runtime parameters.", "Return to Live Chat and verify tool calls."],
        links: [{ label: "OpenXnet", url: "https://openxnet.synapxnet.com/" }]
      }
    };
  const s = e && typeof e.getPrototypeToolkitTile == "function" ? e.getPrototypeToolkitTile(t) : null, i = e && typeof e.getPrototypeToolkitDetailMeta == "function" ? e.getPrototypeToolkitDetailMeta(t) : null, o = String(t || "").trim(), l = is(e, o);
  return {
    id: o,
    title: i?.title || ts(e, s) || (n ? "工具详情" : "Tool Detail"),
    icon: s?.icon || i?.icon || "fa-solid fa-screwdriver-wrench",
    iconColor: ns[o] || "gray",
    description: i?.summary || Yi(e, o, n),
    chips: i?.chips || [],
    status: l,
    statusLabel: Ji(e, l, o, n),
    runtime: e && typeof e.getPrototypeToolkitRuntimeLabel == "function" ? e.getPrototypeToolkitRuntimeLabel(o) : "",
    runtimeMeta: e && typeof e.getPrototypeToolkitRuntimeMeta == "function" ? e.getPrototypeToolkitRuntimeMeta(o) : "",
    version: $s(),
    guide: Dr(o, n)
  };
}
function Nr(e, t, n) {
  switch (t) {
    case "tools":
    case "":
    case void 0:
      return {
        kind: "overview",
        enabled: null,
        fields: {
          summary: n ? "选择一个工具细类后，这里会切换为该工具需要填写的配置。" : "Select a specific tool to show its required configuration here."
        }
      };
    case "websearch":
      return {
        kind: "websearch",
        enabled: !!e?.webSearchSettings?.enabled,
        fields: {
          engine: String(e?.webSearchSettings?.engine || "tavily"),
          crawler: String(e?.webSearchSettings?.crawler || "jina"),
          when: String(e?.webSearchSettings?.when || "after_thinking")
        }
      };
    case "interpreter":
      return {
        kind: "interpreter",
        enabled: !!e?.codeSettings?.enabled,
        fields: {
          engine: String(e?.codeSettings?.engine || "e2b"),
          sandbox_url: String(e?.codeSettings?.sandbox_url || ""),
          e2b_api_key: String(e?.codeSettings?.e2b_api_key || "")
        }
      };
    case "CLI":
      return {
        kind: "CLI",
        enabled: !!e?.CLISettings?.enabled,
        fields: {
          engine: String(e?.CLISettings?.engine || "local"),
          workspace: String(e?.CLISettings?.cc_path || ""),
          visibilityScope: String(e?.CLISettings?.visibilityScope || "workspace"),
          permissionMode: e && typeof e.getActiveCliPermissionModeLabel == "function" ? e.getActiveCliPermissionModeLabel() : "default"
        }
      };
    case "document":
      return {
        kind: "document",
        enabled: Ke(e, "document"),
        fields: {
          top_n: Number(e?.KBSettings?.top_n || 5),
          when: String(e?.KBSettings?.when || "after_thinking"),
          is_rerank: !!e?.KBSettings?.is_rerank,
          kbCount: Array.isArray(e?.knowledgeBases) ? e.knowledgeBases.length : 0
        }
      };
    case "chromeMCP":
      return {
        kind: "chromeMCP",
        enabled: !!e?.chromeMCPSettings?.enabled,
        fields: {
          type: String(e?.chromeMCPSettings?.type || "external"),
          mcpName: String(e?.chromeMCPSettings?.mcpName || "browser-mcp"),
          CDPport: Number(e?.chromeMCPSettings?.CDPport || 9222)
        }
      };
    case "sql":
      return {
        kind: "sql",
        enabled: !!e?.sqlSettings?.enabled,
        fields: {
          engine: String(e?.sqlSettings?.engine || "sqlite"),
          host: String(e?.sqlSettings?.host || ""),
          port: Number(e?.sqlSettings?.port || 5432),
          dbname: String(e?.sqlSettings?.dbname || ""),
          dbpath: String(e?.sqlSettings?.dbpath || "")
        }
      };
    case "HA":
      return {
        kind: "HA",
        enabled: !!e?.HASettings?.enabled,
        fields: {
          url: String(e?.HASettings?.url || ""),
          token: String(e?.HASettings?.token || "")
        }
      };
    case "comfyui":
      return {
        kind: "comfyui",
        enabled: Ke(e, "comfyui"),
        fields: {
          endpoint: String(e?.activeComfyUIUrl || e?.comfyuiServers?.[0] || "http://127.0.0.1:8188"),
          serverCount: Array.isArray(e?.comfyuiServers) ? e.comfyuiServers.length : 0
        }
      };
    case "mcp":
      return {
        kind: "mcp",
        enabled: Ke(e, "mcp"),
        fields: {
          serverCount: Object.keys(e?.mcpServers || {}).length,
          enabledCount: Object.values(e?.mcpServers || {}).filter((s) => !s?.disabled).length
        }
      };
    case "a2a":
      return {
        kind: "a2a",
        enabled: Ke(e, "a2a"),
        fields: {
          serverCount: Object.keys(e?.a2aServers || {}).length,
          enabledCount: Object.values(e?.a2aServers || {}).filter((s) => s?.enabled).length
        }
      };
    case "llmTool":
      return {
        kind: "llmTool",
        enabled: Ke(e, "llmTool"),
        fields: {
          toolCount: Array.isArray(e?.llmTools) ? e.llmTools.length : 0,
          enabledCount: Array.isArray(e?.llmTools) ? e.llmTools.filter((s) => s?.enabled).length : 0
        }
      };
    case "customHttpTool":
      return {
        kind: "customHttpTool",
        enabled: Ke(e, "customHttpTool"),
        fields: {
          toolCount: Array.isArray(e?.customHttpTools) ? e.customHttpTools.length : 0,
          enabledCount: Array.isArray(e?.customHttpTools) ? e.customHttpTools.filter((s) => s?.enabled).length : 0
        }
      };
    case "sticker":
      return {
        kind: "sticker",
        enabled: Ke(e, "sticker"),
        fields: {
          packCount: Array.isArray(e?.stickerPacks) ? e.stickerPacks.length : 0,
          enabledCount: Array.isArray(e?.stickerPacks) ? e.stickerPacks.filter((s) => s?.enabled).length : 0
        }
      };
    default:
      return {
        kind: t || "",
        enabled: null,
        fields: {
          summary: n ? "该工具暂时由其他控制台维护，详细配置请前往对应模块。" : "This tool is configured in another control surface; jump to the dedicated module for full options."
        }
      };
  }
}
function jr() {
  const e = Ze(), t = Or(e), n = String(e?.subMenu || "tools");
  return {
    isZh: t,
    activeMenu: String(e?.activeMenu || ""),
    activeSubMenu: n,
    sections: Hr(e),
    cards: Fr(e, t),
    detail: Br(e, n, t),
    detailForm: Nr(e, n, t),
    searchQuery: String(e?.toolkitOverviewQuery || ""),
    collapsedSections: Array.isArray(e?.prototypeToolkitCollapsedSections) ? e.prototypeToolkitCollapsedSections.slice() : []
  };
}
async function $r(e) {
  const t = Ze();
  if (!(!t || !e)) {
    if (e.targetMenu && typeof t.handleSelect == "function") {
      await t.handleSelect(e.targetMenu), e.targetSubMenu && (t.subMenu = e.targetSubMenu);
      return;
    }
    t.activeMenu = "toolkit", t.subMenu = e.id;
  }
}
async function Ur(e) {
  const t = Ze();
  !t || !e || (t.activeMenu = "toolkit", t.subMenu = String(e));
}
function Kr(e) {
  const t = Ze();
  t && (t.toolkitOverviewQuery = String(e || ""));
}
function qr(e) {
  const t = Ze();
  if (!t) return;
  Array.isArray(t.prototypeToolkitCollapsedSections) || (t.prototypeToolkitCollapsedSections = []);
  const n = t.prototypeToolkitCollapsedSections, s = n.indexOf(e);
  s === -1 ? n.push(e) : n.splice(s, 1);
}
async function Wr(e, t, n) {
  const s = Ze();
  if (s) {
    switch (e) {
      case "websearch":
        s.webSearchSettings[t] = n;
        break;
      case "interpreter":
        s.codeSettings[t] = n;
        break;
      case "CLI":
        t === "workspace" ? s.CLISettings.cc_path = n : s.CLISettings[t] = n;
        break;
      case "document":
        s.KBSettings[t] = n;
        break;
      case "chromeMCP":
        s.chromeMCPSettings[t] = n;
        break;
      case "sql":
        s.sqlSettings[t] = n;
        break;
      case "HA":
        s.HASettings[t] = n;
        break;
      case "comfyui":
        if (t === "endpoint") {
          const i = String(n || "");
          s.activeComfyUIUrl = i, Array.isArray(s.comfyuiServers) || (s.comfyuiServers = []), s.comfyuiServers.length === 0 ? s.comfyuiServers.push(i) : s.comfyuiServers[0] = i;
        }
        break;
      default:
        return;
    }
    typeof s.autoSaveSettings == "function" && await s.autoSaveSettings();
  }
}
async function Vr(e, t) {
  const n = Ze();
  if (!n) return;
  const s = Xi(n, ss[e]);
  if (s.length) {
    s.forEach((i) => {
      i.enabled = !!t;
    }), typeof n.autoSaveSettings == "function" && await n.autoSaveSettings();
    return;
  }
  switch (e) {
    case "websearch":
      if (n.webSearchSettings.enabled = t, typeof n.handleWebSearchToggle == "function") {
        await n.handleWebSearchToggle(t);
        return;
      }
      break;
    case "interpreter":
      if (n.codeSettings.enabled = t, typeof n.handleInterpreterToggle == "function") {
        await n.handleInterpreterToggle(t);
        return;
      }
      break;
    case "CLI":
      if (n.CLISettings.enabled = t, typeof n.handleEnableToggle == "function") {
        n.handleEnableToggle(t);
        return;
      }
      break;
    case "document":
      n.KBSettings && (n.KBSettings.enabled = !!t), Array.isArray(n.knowledgeBases) && (n.knowledgeBases = n.knowledgeBases.map((i) => ({ ...i, enabled: !!t })));
      break;
    case "chromeMCP":
      if (n.chromeMCPSettings.enabled = t, typeof n.changeChromeMCPEnabled == "function") {
        await n.changeChromeMCPEnabled();
        return;
      }
      break;
    case "sql":
      if (n.sqlSettings.enabled = t, typeof n.changeSqlEnabled == "function") {
        await n.changeSqlEnabled();
        return;
      }
      break;
    case "HA":
      if (n.HASettings.enabled = t, typeof n.changeHAEnabled == "function") {
        await n.changeHAEnabled();
        return;
      }
      break;
    default:
      return;
  }
  typeof n.autoSaveSettings == "function" && await n.autoSaveSettings();
}
async function Gr() {
  const e = Ze();
  e && typeof e.autoSaveSettings == "function" && await e.autoSaveSettings();
}
function Qr(e) {
  const t = Ze();
  if (!t) return;
  t.activeMenu = "toolkit", t.subMenu = String(e || "tools");
  const s = {
    llmTool: "switchTollmTools",
    customHttpTool: "switchToHttpTools",
    comfyui: "switchToComfyui",
    sticker: "switchToStickerPacks",
    mcp: "switchTomcpServers",
    a2a: "switchToa2aServers"
  }[e];
  s && typeof t[s] == "function" && t[s]();
}
function Xr() {
  return {
    snapshot: jr,
    selectSubMenu: $r,
    openDetail: Ur,
    setSearchQuery: Kr,
    toggleSectionCollapse: qr,
    updateField: Wr,
    toggleEnabled: Vr,
    saveSettings: Gr,
    openDedicatedConfig: Qr
  };
}
const Zr = { class: "ox-vite-toolkit-shell" }, Jr = { class: "oxt-categories" }, Yr = { class: "oxt-categories__title" }, zr = { class: "oxt-cat-item__label" }, ea = ["onClick"], ta = { class: "oxt-section__body" }, na = ["onClick"], sa = { class: "oxt-cat-item__icon" }, ia = { class: "oxt-cat-item__label" }, oa = { class: "oxt-list" }, la = { class: "oxt-list__header" }, ra = { class: "oxt-search" }, aa = ["placeholder", "value"], ca = ["title"], ua = { class: "oxt-grid-wrapper" }, fa = {
  key: 0,
  class: "oxt-empty"
}, da = {
  key: 1,
  class: "oxt-grid"
}, pa = ["onClick"], ha = { class: "oxt-card__top" }, ga = { class: "oxt-card__info" }, _a = { class: "oxt-card__name-row" }, va = { class: "oxt-card__name" }, ma = ["title"], ba = ["checked", "onChange"], ya = { class: "oxt-card__desc" }, xa = {
  key: 1,
  class: "oxt-config-panel"
}, Sa = { class: "oxt-config-panel__head" }, Ca = { class: "oxt-config-panel__eyebrow" }, wa = {
  key: 0,
  class: "oxt-config-panel__toggle-row"
}, ka = { class: "oxt-toggle" }, Ta = ["checked"], Aa = { class: "oxt-config-panel__section" }, Pa = { class: "oxt-detail__section-title" }, Ea = { class: "oxt-detail__fields" }, Ma = { class: "oxt-field" }, Ia = { class: "oxt-field__label" }, Oa = ["value"], La = { class: "oxt-field" }, Ra = { class: "oxt-field__label" }, Da = ["value"], Ha = { class: "oxt-field" }, Fa = { class: "oxt-field__label" }, Ba = ["value"], Na = { value: "before_thinking" }, ja = { value: "after_thinking" }, $a = { class: "oxt-field" }, Ua = { class: "oxt-field__label" }, Ka = ["value"], qa = { class: "oxt-field" }, Wa = ["value"], Va = { class: "oxt-field" }, Ga = ["value"], Qa = { class: "oxt-field" }, Xa = { class: "oxt-field__label" }, Za = ["value"], Ja = { class: "oxt-field" }, Ya = { class: "oxt-field__label" }, za = ["value"], ec = { class: "oxt-field" }, tc = { class: "oxt-field__label" }, nc = ["value"], sc = { value: "workspace" }, ic = { value: "global" }, oc = { class: "oxt-note" }, lc = { class: "oxt-field" }, rc = { class: "oxt-field__label" }, ac = ["value"], cc = { class: "oxt-field" }, uc = { class: "oxt-field__label" }, fc = ["value"], dc = { value: "before_thinking" }, pc = { value: "after_thinking" }, hc = { class: "oxt-field oxt-field--inline" }, gc = { class: "oxt-field__label" }, _c = { class: "oxt-toggle" }, vc = ["checked"], mc = { class: "oxt-note" }, bc = { class: "oxt-field" }, yc = { class: "oxt-field__label" }, xc = ["value"], Sc = { value: "external" }, Cc = { value: "internal" }, wc = { class: "oxt-field" }, kc = ["value"], Tc = { class: "oxt-field" }, Ac = ["value"], Pc = { class: "oxt-field" }, Ec = { class: "oxt-field__label" }, Mc = ["value"], Ic = { class: "oxt-field" }, Oc = ["value"], Lc = { class: "oxt-field" }, Rc = ["value"], Dc = { class: "oxt-field" }, Hc = ["value"], Fc = { class: "oxt-field" }, Bc = ["value"], Nc = { class: "oxt-field" }, jc = ["value"], $c = { class: "oxt-field" }, Uc = ["value"], Kc = { class: "oxt-field" }, qc = { class: "oxt-field__label" }, Wc = ["value"], Vc = { class: "oxt-note" }, Gc = { class: "oxt-note" }, Qc = { class: "oxt-config-metrics" }, Xc = {
  key: 9,
  class: "oxt-note"
}, Zc = {
  key: 1,
  class: "oxt-config-panel__actions"
}, Jc = { class: "oxt-detail" }, Yc = {
  key: 0,
  class: "oxt-detail__empty"
}, zc = {
  key: 1,
  class: "oxt-detail__content oxt-guide"
}, eu = { class: "oxt-detail__header" }, tu = { class: "oxt-detail__top" }, nu = { class: "oxt-detail__title-group" }, su = { class: "oxt-detail__name" }, iu = {
  key: 0,
  class: "oxt-detail__version"
}, ou = { class: "oxt-detail__desc" }, lu = {
  key: 0,
  class: "oxt-guide__chips"
}, ru = { class: "oxt-guide__section" }, au = { class: "oxt-detail__section-title" }, cu = { class: "oxt-guide__text" }, uu = { class: "oxt-guide__section" }, fu = { class: "oxt-detail__section-title" }, du = { class: "oxt-guide__steps" }, pu = {
  key: 1,
  class: "oxt-guide__section"
}, hu = { class: "oxt-detail__section-title" }, gu = { class: "oxt-guide__links" }, _u = ["href"], vu = {
  key: 2,
  class: "oxt-guide__section oxt-guide__section--runtime"
}, mu = { class: "oxt-detail__section-title" }, bu = { class: "oxt-meta-row" }, yu = { class: "oxt-meta-row__label" }, xu = { class: "oxt-meta-row__value" }, Su = {
  key: 0,
  class: "oxt-meta-row"
}, Cu = { class: "oxt-meta-row__label" }, wu = { class: "oxt-meta-row__value oxt-meta-row__value--muted" }, ku = {
  __name: "App",
  setup(e) {
    const t = Xr(), n = /* @__PURE__ */ Ho(t.snapshot());
    let s = null;
    function i() {
      n.value = t.snapshot();
    }
    function o(te) {
      t.selectSubMenu(te), i();
    }
    function l() {
      t.selectSubMenu({ id: "tools" }), i();
    }
    function r(te) {
      t.openDetail(te.id), i();
    }
    function c(te, g) {
      g && typeof g.stopPropagation == "function" && g.stopPropagation(), te?.canToggle && t.toggleEnabled(te.id, !!g?.target?.checked).finally(i);
    }
    function p(te) {
      t.setSearchQuery(te.target.value), i();
    }
    function d() {
      t.setSearchQuery(""), i();
    }
    function _(te) {
      t.toggleSectionCollapse(te), i();
    }
    function S(te, g, x) {
      let U;
      x.target.type === "checkbox" ? U = x.target.checked : x.target.type === "number" ? U = Number(x.target.value) : U = x.target.value, t.updateField(te, g, U);
    }
    function I(te, g) {
      t.toggleEnabled(te, !!g?.target?.checked).finally(i);
    }
    async function q() {
      await t.saveSettings(), i();
    }
    function H() {
      t.openDedicatedConfig(O.value), i();
    }
    const T = ve(() => n.value.isZh), X = ve(() => n.value.sections || []), $ = ve(() => n.value.cards || []), O = ve(() => n.value.activeSubMenu || ""), P = ve(() => n.value.detail || {}), M = ve(() => n.value.detailForm || { kind: "", enabled: null, fields: {} }), xe = ve(() => n.value.searchQuery || ""), be = ve(() => new Set(n.value.collapsedSections || [])), Se = ve(() => !O.value || O.value === "tools"), ct = ve(() => !!P.value?.id), ge = ve(() => P.value?.guide || { intro: "", setupSteps: [], links: [] }), et = ve(() => ["comfyui", "mcp", "a2a", "llmTool", "customHttpTool", "sticker"].includes(M.value.kind));
    function ut(te) {
      return te.statusLabel || (te.status === "running" ? T.value ? "运行中" : "Running" : te.status === "not-installed" ? T.value ? "未安装" : "Not installed" : T.value ? "已安装" : "Installed");
    }
    return Ci(() => {
      i(), s = window.setInterval(i, 400);
    }), wi(() => {
      s && (window.clearInterval(s), s = null);
    }), (te, g) => (B(), N("div", Zr, [
      f("aside", Jr, [
        f("div", Yr, E(T.value ? "工具分类" : "Categories"), 1),
        f("button", {
          type: "button",
          class: oe(["oxt-cat-item oxt-cat-item--overview", { "is-active": Se.value }]),
          onClick: l
        }, [
          g[25] || (g[25] = f("span", { class: "oxt-cat-item__icon" }, [
            f("i", { class: "fa-solid fa-table-cells-large" })
          ], -1)),
          f("span", zr, E(T.value ? "工具概览" : "Tool Overview"), 1)
        ], 2),
        (B(!0), N(ee, null, dt(X.value, (x) => (B(), N("div", {
          key: x.id,
          class: oe(["oxt-section", { "is-collapsed": be.value.has(x.id) }])
        }, [
          f("button", {
            type: "button",
            class: "oxt-section__header",
            onClick: (U) => _(x.id)
          }, [
            g[26] || (g[26] = f("i", { class: "fa-solid fa-chevron-down" }, null, -1)),
            f("span", null, E(x.label), 1)
          ], 8, ea),
          f("div", ta, [
            (B(!0), N(ee, null, dt(x.items, (U) => (B(), N("button", {
              key: U.id,
              type: "button",
              class: oe(["oxt-cat-item", { "is-active": O.value === U.id }]),
              onClick: (ne) => o(U)
            }, [
              f("span", sa, [
                f("i", {
                  class: oe(U.icon)
                }, null, 2)
              ]),
              f("span", ia, E(U.label), 1),
              U.status === "running" || U.status === "installed" ? (B(), N("span", {
                key: 0,
                class: oe(["oxt-cat-item__badge", `is-${U.status}`])
              }, null, 2)) : $e("", !0)
            ], 10, na))), 128))
          ])
        ], 2))), 128))
      ]),
      f("section", oa, [
        f("div", la, [
          f("div", ra, [
            g[28] || (g[28] = f("i", { class: "fa-solid fa-magnifying-glass oxt-search__icon" }, null, -1)),
            f("input", {
              type: "text",
              class: "oxt-search__input",
              placeholder: T.value ? "搜索工具..." : "Search tools...",
              value: xe.value,
              onInput: p
            }, null, 40, aa),
            xe.value ? (B(), N("button", {
              key: 0,
              type: "button",
              class: "oxt-search__clear",
              title: T.value ? "清除" : "Clear",
              onClick: d
            }, [...g[27] || (g[27] = [
              f("i", { class: "fa-solid fa-xmark" }, null, -1)
            ])], 8, ca)) : $e("", !0)
          ])
        ]),
        f("div", ua, [
          Se.value ? (B(), N(ee, { key: 0 }, [
            $.value.length === 0 ? (B(), N("div", fa, [
              g[29] || (g[29] = f("i", { class: "fa-solid fa-toolbox" }, null, -1)),
              f("span", null, E(T.value ? "没有匹配的工具" : "No matching tools"), 1)
            ])) : (B(), N("div", da, [
              (B(!0), N(ee, null, dt($.value, (x) => (B(), N("article", {
                key: x.id,
                class: oe(["oxt-card", [{ "is-selected": O.value === x.id }]]),
                onClick: (U) => r(x)
              }, [
                f("div", ha, [
                  f("div", {
                    class: oe(["oxt-card__icon", `oxt-card__icon--${x.iconColor}`])
                  }, [
                    f("i", {
                      class: oe(x.icon)
                    }, null, 2)
                  ], 2),
                  f("div", ga, [
                    f("div", _a, [
                      f("span", va, E(x.label), 1),
                      x.canToggle ? (B(), N("label", {
                        key: 0,
                        class: "oxt-card-switch",
                        title: x.toggleLabel,
                        onClick: g[0] || (g[0] = Tr(() => {
                        }, ["stop"]))
                      }, [
                        f("input", {
                          type: "checkbox",
                          checked: x.enabled,
                          onChange: (U) => c(x, U)
                        }, null, 40, ba),
                        g[30] || (g[30] = f("span", { class: "oxt-card-switch__slider" }, null, -1))
                      ], 8, ma)) : (B(), N("span", {
                        key: 1,
                        class: oe(["oxt-card__status", `is-${x.status}`])
                      }, E(ut(x)), 3))
                    ]),
                    f("div", ya, E(x.description), 1)
                  ])
                ])
              ], 10, pa))), 128))
            ]))
          ], 64)) : (B(), N("div", xa, [
            f("div", Sa, [
              f("div", {
                class: oe(["oxt-config-panel__icon", `oxt-card__icon--${P.value.iconColor}`])
              }, [
                f("i", {
                  class: oe(P.value.icon)
                }, null, 2)
              ], 2),
              f("div", null, [
                f("div", Ca, E(T.value ? "工具配置" : "Tool Configuration"), 1),
                f("h2", null, E(P.value.title), 1)
              ])
            ]),
            M.value.enabled !== null ? (B(), N("div", wa, [
              f("div", null, [
                f("strong", null, E(T.value ? "启用工具" : "Enable Tool"), 1),
                f("span", null, E(T.value ? "开关会同步到实时对话工具状态。" : "This switch syncs to Live Chat tool state."), 1)
              ]),
              f("label", ka, [
                f("input", {
                  type: "checkbox",
                  checked: M.value.enabled,
                  onChange: g[1] || (g[1] = (x) => I(O.value, x))
                }, null, 40, Ta),
                g[31] || (g[31] = f("span", { class: "oxt-toggle__slider" }, null, -1))
              ])
            ])) : $e("", !0),
            f("div", Aa, [
              f("div", Pa, E(T.value ? "需要填写的配置" : "Required Configuration"), 1),
              f("div", Ea, [
                M.value.kind === "websearch" ? (B(), N(ee, { key: 0 }, [
                  f("label", Ma, [
                    f("span", Ia, E(T.value ? "搜索引擎" : "Search Engine"), 1),
                    f("select", {
                      class: "oxt-field__input",
                      value: M.value.fields.engine,
                      onChange: g[2] || (g[2] = (x) => S(O.value, "engine", x))
                    }, [...g[32] || (g[32] = [
                      Ts('<option value="tavily">Tavily</option><option value="duckduckgo">DuckDuckGo</option><option value="searxng">SearXNG</option><option value="bing">Bing</option><option value="google">Google</option>', 5)
                    ])], 40, Oa)
                  ]),
                  f("label", La, [
                    f("span", Ra, E(T.value ? "抓取器" : "Crawler"), 1),
                    f("select", {
                      class: "oxt-field__input",
                      value: M.value.fields.crawler,
                      onChange: g[3] || (g[3] = (x) => S(O.value, "crawler", x))
                    }, [...g[33] || (g[33] = [
                      f("option", { value: "jina" }, "Jina", -1),
                      f("option", { value: "simpleRequest" }, "Simple Request", -1),
                      f("option", { value: "crawl4ai" }, "Crawl4AI", -1),
                      f("option", { value: "firecrawl" }, "Firecrawl", -1)
                    ])], 40, Da)
                  ]),
                  f("label", Ha, [
                    f("span", Fa, E(T.value ? "注入时机" : "Injection Timing"), 1),
                    f("select", {
                      class: "oxt-field__input",
                      value: M.value.fields.when,
                      onChange: g[4] || (g[4] = (x) => S(O.value, "when", x))
                    }, [
                      f("option", Na, E(T.value ? "推理前" : "Before thinking"), 1),
                      f("option", ja, E(T.value ? "推理后" : "After thinking"), 1)
                    ], 40, Ba)
                  ])
                ], 64)) : M.value.kind === "interpreter" ? (B(), N(ee, { key: 1 }, [
                  f("label", $a, [
                    f("span", Ua, E(T.value ? "执行引擎" : "Execution Engine"), 1),
                    f("select", {
                      class: "oxt-field__input",
                      value: M.value.fields.engine,
                      onChange: g[5] || (g[5] = (x) => S(O.value, "engine", x))
                    }, [...g[34] || (g[34] = [
                      f("option", { value: "e2b" }, "E2B", -1),
                      f("option", { value: "sandbox" }, "Sandbox", -1)
                    ])], 40, Ka)
                  ]),
                  f("label", qa, [
                    g[35] || (g[35] = f("span", { class: "oxt-field__label" }, "Sandbox URL", -1)),
                    f("input", {
                      class: "oxt-field__input",
                      value: M.value.fields.sandbox_url,
                      type: "text",
                      onInput: g[6] || (g[6] = (x) => S(O.value, "sandbox_url", x))
                    }, null, 40, Wa)
                  ]),
                  f("label", Va, [
                    g[36] || (g[36] = f("span", { class: "oxt-field__label" }, "E2B API Key", -1)),
                    f("input", {
                      class: "oxt-field__input",
                      value: M.value.fields.e2b_api_key,
                      type: "password",
                      onInput: g[7] || (g[7] = (x) => S(O.value, "e2b_api_key", x))
                    }, null, 40, Ga)
                  ])
                ], 64)) : M.value.kind === "CLI" ? (B(), N(ee, { key: 2 }, [
                  f("label", Qa, [
                    f("span", Xa, E(T.value ? "CLI 引擎" : "CLI Engine"), 1),
                    f("select", {
                      class: "oxt-field__input",
                      value: M.value.fields.engine,
                      onChange: g[8] || (g[8] = (x) => S(O.value, "engine", x))
                    }, [...g[37] || (g[37] = [
                      Ts('<option value="local">Local</option><option value="ds">Docker Sandbox</option><option value="cc">Claude Code</option><option value="oc">Codex</option><option value="qc">Qwen Code</option>', 5)
                    ])], 40, Za)
                  ]),
                  f("label", Ja, [
                    f("span", Ya, E(T.value ? "工作区路径" : "Workspace Path"), 1),
                    f("input", {
                      class: "oxt-field__input",
                      value: M.value.fields.workspace,
                      type: "text",
                      onInput: g[9] || (g[9] = (x) => S(O.value, "workspace", x))
                    }, null, 40, za)
                  ]),
                  f("label", ec, [
                    f("span", tc, E(T.value ? "可见范围" : "Visibility Scope"), 1),
                    f("select", {
                      class: "oxt-field__input",
                      value: M.value.fields.visibilityScope,
                      onChange: g[10] || (g[10] = (x) => S(O.value, "visibilityScope", x))
                    }, [
                      f("option", sc, E(T.value ? "工作区" : "Workspace"), 1),
                      f("option", ic, E(T.value ? "全局" : "Global"), 1)
                    ], 40, nc)
                  ]),
                  f("div", oc, E(T.value ? "当前权限模式" : "Permission mode") + ": " + E(M.value.fields.permissionMode), 1)
                ], 64)) : M.value.kind === "document" ? (B(), N(ee, { key: 3 }, [
                  f("label", lc, [
                    f("span", rc, E(T.value ? "返回片段数" : "Top N Chunks"), 1),
                    f("input", {
                      class: "oxt-field__input",
                      value: M.value.fields.top_n,
                      type: "number",
                      min: "1",
                      step: "1",
                      onInput: g[11] || (g[11] = (x) => S(O.value, "top_n", x))
                    }, null, 40, ac)
                  ]),
                  f("label", cc, [
                    f("span", uc, E(T.value ? "检索时机" : "Retrieval Timing"), 1),
                    f("select", {
                      class: "oxt-field__input",
                      value: M.value.fields.when,
                      onChange: g[12] || (g[12] = (x) => S(O.value, "when", x))
                    }, [
                      f("option", dc, E(T.value ? "推理前" : "Before thinking"), 1),
                      f("option", pc, E(T.value ? "推理后" : "After thinking"), 1)
                    ], 40, fc)
                  ]),
                  f("label", hc, [
                    f("span", gc, E(T.value ? "启用重排" : "Enable Rerank"), 1),
                    f("label", _c, [
                      f("input", {
                        type: "checkbox",
                        checked: M.value.fields.is_rerank,
                        onChange: g[13] || (g[13] = (x) => S(O.value, "is_rerank", x))
                      }, null, 40, vc),
                      g[38] || (g[38] = f("span", { class: "oxt-toggle__slider" }, null, -1))
                    ])
                  ]),
                  f("div", mc, E(T.value ? "已配置知识库" : "Knowledge bases") + ": " + E(M.value.fields.kbCount), 1)
                ], 64)) : M.value.kind === "chromeMCP" ? (B(), N(ee, { key: 4 }, [
                  f("label", bc, [
                    f("span", yc, E(T.value ? "接入类型" : "Route Type"), 1),
                    f("select", {
                      class: "oxt-field__input",
                      value: M.value.fields.type,
                      onChange: g[14] || (g[14] = (x) => S(O.value, "type", x))
                    }, [
                      f("option", Sc, E(T.value ? "外部 MCP" : "External MCP"), 1),
                      f("option", Cc, E(T.value ? "内置浏览器" : "Internal Browser"), 1)
                    ], 40, xc)
                  ]),
                  f("label", wc, [
                    g[39] || (g[39] = f("span", { class: "oxt-field__label" }, "MCP Name", -1)),
                    f("input", {
                      class: "oxt-field__input",
                      value: M.value.fields.mcpName,
                      type: "text",
                      onInput: g[15] || (g[15] = (x) => S(O.value, "mcpName", x))
                    }, null, 40, kc)
                  ]),
                  f("label", Tc, [
                    g[40] || (g[40] = f("span", { class: "oxt-field__label" }, "CDP Port", -1)),
                    f("input", {
                      class: "oxt-field__input",
                      value: M.value.fields.CDPport,
                      type: "number",
                      min: "1",
                      step: "1",
                      onInput: g[16] || (g[16] = (x) => S(O.value, "CDPport", x))
                    }, null, 40, Ac)
                  ])
                ], 64)) : M.value.kind === "sql" ? (B(), N(ee, { key: 5 }, [
                  f("label", Pc, [
                    f("span", Ec, E(T.value ? "数据库引擎" : "Database Engine"), 1),
                    f("select", {
                      class: "oxt-field__input",
                      value: M.value.fields.engine,
                      onChange: g[17] || (g[17] = (x) => S(O.value, "engine", x))
                    }, [...g[41] || (g[41] = [
                      f("option", { value: "sqlite" }, "SQLite", -1),
                      f("option", { value: "postgres" }, "Postgres", -1),
                      f("option", { value: "mysql" }, "MySQL", -1)
                    ])], 40, Mc)
                  ]),
                  f("label", Ic, [
                    g[42] || (g[42] = f("span", { class: "oxt-field__label" }, "Host", -1)),
                    f("input", {
                      class: "oxt-field__input",
                      value: M.value.fields.host,
                      type: "text",
                      onInput: g[18] || (g[18] = (x) => S(O.value, "host", x))
                    }, null, 40, Oc)
                  ]),
                  f("label", Lc, [
                    g[43] || (g[43] = f("span", { class: "oxt-field__label" }, "Port", -1)),
                    f("input", {
                      class: "oxt-field__input",
                      value: M.value.fields.port,
                      type: "number",
                      min: "1",
                      step: "1",
                      onInput: g[19] || (g[19] = (x) => S(O.value, "port", x))
                    }, null, 40, Rc)
                  ]),
                  f("label", Dc, [
                    g[44] || (g[44] = f("span", { class: "oxt-field__label" }, "DB Name", -1)),
                    f("input", {
                      class: "oxt-field__input",
                      value: M.value.fields.dbname,
                      type: "text",
                      onInput: g[20] || (g[20] = (x) => S(O.value, "dbname", x))
                    }, null, 40, Hc)
                  ]),
                  f("label", Fc, [
                    g[45] || (g[45] = f("span", { class: "oxt-field__label" }, "DB Path", -1)),
                    f("input", {
                      class: "oxt-field__input",
                      value: M.value.fields.dbpath,
                      type: "text",
                      onInput: g[21] || (g[21] = (x) => S(O.value, "dbpath", x))
                    }, null, 40, Bc)
                  ])
                ], 64)) : M.value.kind === "HA" ? (B(), N(ee, { key: 6 }, [
                  f("label", Nc, [
                    g[46] || (g[46] = f("span", { class: "oxt-field__label" }, "URL", -1)),
                    f("input", {
                      class: "oxt-field__input",
                      value: M.value.fields.url,
                      type: "text",
                      onInput: g[22] || (g[22] = (x) => S(O.value, "url", x)),
                      placeholder: "http://homeassistant.local:8123"
                    }, null, 40, jc)
                  ]),
                  f("label", $c, [
                    g[47] || (g[47] = f("span", { class: "oxt-field__label" }, "Token", -1)),
                    f("input", {
                      class: "oxt-field__input",
                      value: M.value.fields.token,
                      type: "password",
                      onInput: g[23] || (g[23] = (x) => S(O.value, "token", x))
                    }, null, 40, Uc)
                  ])
                ], 64)) : M.value.kind === "comfyui" ? (B(), N(ee, { key: 7 }, [
                  f("label", Kc, [
                    f("span", qc, E(T.value ? "服务地址" : "Service endpoint"), 1),
                    f("input", {
                      class: "oxt-field__input",
                      value: M.value.fields.endpoint,
                      type: "text",
                      onInput: g[24] || (g[24] = (x) => S(O.value, "endpoint", x))
                    }, null, 40, Wc)
                  ]),
                  f("div", Vc, E(T.value ? "已登记服务数" : "Registered services") + ": " + E(M.value.fields.serverCount), 1)
                ], 64)) : et.value ? (B(), N(ee, { key: 8 }, [
                  f("div", Gc, E(T.value ? "该工具由独立管理模块维护，下面显示当前登记数量。" : "This tool is maintained by a dedicated manager. Counts are shown below."), 1),
                  f("div", Qc, [
                    f("span", null, E(M.value.fields.serverCount ?? M.value.fields.toolCount ?? M.value.fields.packCount ?? 0), 1),
                    f("small", null, E(T.value ? "已登记" : "Registered"), 1),
                    f("span", null, E(M.value.fields.enabledCount ?? 0), 1),
                    f("small", null, E(T.value ? "已启用" : "Enabled"), 1)
                  ]),
                  f("button", {
                    type: "button",
                    class: "oxt-btn",
                    onClick: H
                  }, [
                    g[48] || (g[48] = f("i", { class: "fa-solid fa-arrow-up-right-from-square" }, null, -1)),
                    f("span", null, E(T.value ? "打开详细配置" : "Open detailed config"), 1)
                  ])
                ], 64)) : (B(), N("div", Xc, E(M.value.fields.summary), 1))
              ])
            ]),
            M.value.kind && M.value.kind !== "overview" ? (B(), N("div", Zc, [
              f("button", {
                type: "button",
                class: "oxt-btn oxt-btn--ghost",
                onClick: q
              }, [
                g[49] || (g[49] = f("i", { class: "fa-solid fa-floppy-disk" }, null, -1)),
                f("span", null, E(T.value ? "保存" : "Save"), 1)
              ])
            ])) : $e("", !0)
          ]))
        ])
      ]),
      f("aside", Jc, [
        ct.value ? (B(), N("div", zc, [
          f("div", eu, [
            f("div", tu, [
              f("div", {
                class: oe(["oxt-detail__icon", `oxt-card__icon--${P.value.iconColor}`])
              }, [
                f("i", {
                  class: oe(P.value.icon)
                }, null, 2)
              ], 2),
              f("div", nu, [
                f("div", su, [
                  f("span", null, E(P.value.title), 1),
                  P.value.version ? (B(), N("span", iu, E(P.value.version), 1)) : $e("", !0)
                ]),
                f("div", {
                  class: oe(["oxt-detail__status", `is-${P.value.status}`])
                }, [
                  f("span", {
                    class: oe(["oxt-detail__status-dot", `is-${P.value.status}`])
                  }, null, 2),
                  f("span", null, E(P.value.statusLabel), 1)
                ], 2)
              ])
            ])
          ]),
          f("p", ou, E(P.value.description), 1),
          P.value.chips && P.value.chips.length ? (B(), N("div", lu, [
            (B(!0), N(ee, null, dt(P.value.chips, (x) => (B(), N("span", {
              key: x.text,
              class: oe(["oxt-guide-chip", { "is-muted": x.muted }])
            }, [
              f("i", {
                class: oe(x.icon)
              }, null, 2),
              f("span", null, E(x.text), 1)
            ], 2))), 128))
          ])) : $e("", !0),
          f("div", ru, [
            f("div", au, E(T.value ? "功能介绍" : "Feature"), 1),
            f("p", cu, E(ge.value.intro), 1)
          ]),
          f("div", uu, [
            f("div", fu, E(T.value ? "如何配置" : "Setup"), 1),
            f("ol", du, [
              (B(!0), N(ee, null, dt(ge.value.setupSteps, (x) => (B(), N("li", { key: x }, E(x), 1))), 128))
            ])
          ]),
          ge.value.links && ge.value.links.length ? (B(), N("div", pu, [
            f("div", hu, E(T.value ? "相关网站" : "Related Sites"), 1),
            f("div", gu, [
              (B(!0), N(ee, null, dt(ge.value.links, (x) => (B(), N("a", {
                key: x.url,
                class: "oxt-guide-link",
                href: x.url,
                target: "_blank",
                rel: "noreferrer"
              }, [
                g[51] || (g[51] = f("i", { class: "fa-solid fa-arrow-up-right-from-square" }, null, -1)),
                f("span", null, E(x.label), 1)
              ], 8, _u))), 128))
            ])
          ])) : $e("", !0),
          P.value.runtime ? (B(), N("div", vu, [
            f("div", mu, E(T.value ? "当前线索" : "Current Clue"), 1),
            f("div", bu, [
              f("span", yu, E(T.value ? "当前配置" : "Current"), 1),
              f("span", xu, E(P.value.runtime), 1)
            ]),
            P.value.runtimeMeta ? (B(), N("div", Su, [
              f("span", Cu, E(T.value ? "说明" : "Note"), 1),
              f("span", wu, E(P.value.runtimeMeta), 1)
            ])) : $e("", !0)
          ])) : $e("", !0)
        ])) : (B(), N("div", Yc, [
          g[50] || (g[50] = f("i", { class: "fa-solid fa-toolbox" }, null, -1)),
          f("span", null, E(T.value ? "选择一个工具查看详情" : "Select a tool to view details"), 1)
        ]))
      ])
    ]));
  }
};
function Dn() {
  const e = document.getElementById("openxnet-vite-toolkit-root");
  !e || e.dataset.viteMounted === "true" || (Er(ku).mount(e), e.dataset.viteMounted = "true");
}
document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", Dn, { once: !0 }) : Dn();
window.addEventListener("openxnet-vite-toolkit-remount", Dn);
