var Au = (e, t) => () => (t || e((t = { exports: {} }).exports, t), t.exports);
var Px = Au((Nx, zi) => {
  // @__NO_SIDE_EFFECTS__
  function _o(e) {
    const t = /* @__PURE__ */ Object.create(null);
    for (const n of e.split(",")) t[n] = 1;
    return (n) => n in t;
  }
  const Be = {}, Fn = [], Ht = () => {
  }, Ar = () => !1, rs = (e) => e.charCodeAt(0) === 111 && e.charCodeAt(1) === 110 && // uppercase letter
  (e.charCodeAt(2) > 122 || e.charCodeAt(2) < 97), ls = (e) => e.startsWith("onUpdate:"), Ye = Object.assign, wo = (e, t) => {
    const n = e.indexOf(t);
    n > -1 && e.splice(n, 1);
  }, Iu = Object.prototype.hasOwnProperty, De = (e, t) => Iu.call(e, t), Ce = Array.isArray, qn = (e) => ki(e) === "[object Map]", Ir = (e) => ki(e) === "[object Set]", $a = (e) => ki(e) === "[object Date]", Ie = (e) => typeof e == "function", ze = (e) => typeof e == "string", Bt = (e) => typeof e == "symbol", qe = (e) => e !== null && typeof e == "object", $r = (e) => (qe(e) || Ie(e)) && Ie(e.then) && Ie(e.catch), Mr = Object.prototype.toString, ki = (e) => Mr.call(e), $u = (e) => ki(e).slice(8, -1), Tr = (e) => ki(e) === "[object Object]", ko = (e) => ze(e) && e !== "NaN" && e[0] !== "-" && "" + parseInt(e, 10) === e, li = /* @__PURE__ */ _o(
    // the leading comma is intentional so empty string "" is also included
    ",key,ref,ref_for,ref_key,onVnodeBeforeMount,onVnodeMounted,onVnodeBeforeUpdate,onVnodeUpdated,onVnodeBeforeUnmount,onVnodeUnmounted"
  ), cs = (e) => {
    const t = /* @__PURE__ */ Object.create(null);
    return ((n) => t[n] || (t[n] = e(n)));
  }, Mu = /-\w/g, $t = cs(
    (e) => e.replace(Mu, (t) => t.slice(1).toUpperCase())
  ), Tu = /\B([A-Z])/g, fn = cs(
    (e) => e.replace(Tu, "-$1").toLowerCase()
  ), Pr = cs((e) => e.charAt(0).toUpperCase() + e.slice(1)), Os = cs(
    (e) => e ? `on${Pr(e)}` : ""
  ), jt = (e, t) => !Object.is(e, t), Vi = (e, ...t) => {
    for (let n = 0; n < e.length; n++)
      e[n](...t);
  }, Er = (e, t, n, i = !1) => {
    Object.defineProperty(e, t, {
      configurable: !0,
      enumerable: !1,
      writable: i,
      value: n
    });
  }, xo = (e) => {
    const t = parseFloat(e);
    return isNaN(t) ? e : t;
  }, Pu = (e) => {
    const t = ze(e) ? Number(e) : NaN;
    return isNaN(t) ? e : t;
  };
  let Ma;
  const us = () => Ma || (Ma = typeof globalThis < "u" ? globalThis : typeof self < "u" ? self : typeof window < "u" ? window : typeof globalThis < "u" ? globalThis : {});
  function un(e) {
    if (Ce(e)) {
      const t = {};
      for (let n = 0; n < e.length; n++) {
        const i = e[n], s = ze(i) ? Lu(i) : un(i);
        if (s)
          for (const a in s)
            t[a] = s[a];
      }
      return t;
    } else if (ze(e) || qe(e))
      return e;
  }
  const Eu = /;(?![^(]*\))/g, Ru = /:([^]+)/, Nu = /\/\*[^]*?\*\//g;
  function Lu(e) {
    const t = {};
    return e.replace(Nu, "").split(Eu).forEach((n) => {
      if (n) {
        const i = n.split(Ru);
        i.length > 1 && (t[i[0].trim()] = i[1].trim());
      }
    }), t;
  }
  function se(e) {
    let t = "";
    if (ze(e))
      t = e;
    else if (Ce(e))
      for (let n = 0; n < e.length; n++) {
        const i = se(e[n]);
        i && (t += i + " ");
      }
    else if (qe(e))
      for (const n in e)
        e[n] && (t += n + " ");
    return t.trim();
  }
  const Ou = "itemscope,allowfullscreen,formnovalidate,ismap,nomodule,novalidate,readonly", Du = /* @__PURE__ */ _o(Ou);
  function Rr(e) {
    return !!e || e === "";
  }
  function Fu(e, t) {
    if (e.length !== t.length) return !1;
    let n = !0;
    for (let i = 0; n && i < e.length; i++)
      n = So(e[i], t[i]);
    return n;
  }
  function So(e, t) {
    if (e === t) return !0;
    let n = $a(e), i = $a(t);
    if (n || i)
      return n && i ? e.getTime() === t.getTime() : !1;
    if (n = Bt(e), i = Bt(t), n || i)
      return e === t;
    if (n = Ce(e), i = Ce(t), n || i)
      return n && i ? Fu(e, t) : !1;
    if (n = qe(e), i = qe(t), n || i) {
      if (!n || !i)
        return !1;
      const s = Object.keys(e).length, a = Object.keys(t).length;
      if (s !== a)
        return !1;
      for (const r in e) {
        const c = e.hasOwnProperty(r), f = t.hasOwnProperty(r);
        if (c && !f || !c && f || !So(e[r], t[r]))
          return !1;
      }
    }
    return String(e) === String(t);
  }
  const Nr = (e) => !!(e && e.__v_isRef === !0), u = (e) => ze(e) ? e : e == null ? "" : Ce(e) || qe(e) && (e.toString === Mr || !Ie(e.toString)) ? Nr(e) ? u(e.value) : JSON.stringify(e, Lr, 2) : String(e), Lr = (e, t) => Nr(t) ? Lr(e, t.value) : qn(t) ? {
    [`Map(${t.size})`]: [...t.entries()].reduce(
      (n, [i, s], a) => (n[Ds(i, a) + " =>"] = s, n),
      {}
    )
  } : Ir(t) ? {
    [`Set(${t.size})`]: [...t.values()].map((n) => Ds(n))
  } : Bt(t) ? Ds(t) : qe(t) && !Ce(t) && !Tr(t) ? String(t) : t, Ds = (e, t = "") => {
    var n;
    return (
      // Symbol.description in es2019+ so we need to cast here to pass
      // the lib: es2016 check
      Bt(e) ? `Symbol(${(n = e.description) != null ? n : t})` : e
    );
  };
  let tt;
  class qu {
    // TODO isolatedDeclarations "__v_skip"
    constructor(t = !1) {
      this.detached = t, this._active = !0, this._on = 0, this.effects = [], this.cleanups = [], this._isPaused = !1, this._warnOnRun = !0, this.__v_skip = !0, !t && tt && (tt.active ? (this.parent = tt, this.index = (tt.scopes || (tt.scopes = [])).push(
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
        const n = tt;
        try {
          return tt = this, t();
        } finally {
          tt = n;
        }
      }
    }
    /**
     * This should only be called on non-detached scopes
     * @internal
     */
    on() {
      ++this._on === 1 && (this.prevScope = tt, tt = this);
    }
    /**
     * This should only be called on non-detached scopes
     * @internal
     */
    off() {
      if (this._on > 0 && --this._on === 0) {
        if (tt === this)
          tt = this.prevScope;
        else {
          let t = tt;
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
          const s = this.parent.scopes.pop();
          s && s !== this && (this.parent.scopes[this.index] = s, s.index = this.index);
        }
        this.parent = void 0;
      }
    }
  }
  function ju() {
    return tt;
  }
  let Ue;
  const Fs = /* @__PURE__ */ new WeakSet();
  class Or {
    constructor(t) {
      this.fn = t, this.deps = void 0, this.depsTail = void 0, this.flags = 5, this.next = void 0, this.cleanup = void 0, this.scheduler = void 0, tt && (tt.active ? tt.effects.push(this) : this.flags &= -2);
    }
    pause() {
      this.flags |= 64;
    }
    resume() {
      this.flags & 64 && (this.flags &= -65, Fs.has(this) && (Fs.delete(this), this.trigger()));
    }
    /**
     * @internal
     */
    notify() {
      this.flags & 2 && !(this.flags & 32) || this.flags & 8 || Fr(this);
    }
    run() {
      if (!(this.flags & 1))
        return this.fn();
      this.flags |= 2, Ta(this), qr(this);
      const t = Ue, n = Mt;
      Ue = this, Mt = !0;
      try {
        return this.fn();
      } finally {
        jr(this), Ue = t, Mt = n, this.flags &= -3;
      }
    }
    stop() {
      if (this.flags & 1) {
        for (let t = this.deps; t; t = t.nextDep)
          Io(t);
        this.deps = this.depsTail = void 0, Ta(this), this.onStop && this.onStop(), this.flags &= -2;
      }
    }
    trigger() {
      this.flags & 64 ? Fs.add(this) : this.scheduler ? this.scheduler() : this.runIfDirty();
    }
    /**
     * @internal
     */
    runIfDirty() {
      Ys(this) && this.run();
    }
    get dirty() {
      return Ys(this);
    }
  }
  let Dr = 0, ci, ui;
  function Fr(e, t = !1) {
    if (e.flags |= 8, t) {
      e.next = ui, ui = e;
      return;
    }
    e.next = ci, ci = e;
  }
  function Co() {
    Dr++;
  }
  function Ao() {
    if (--Dr > 0)
      return;
    if (ui) {
      let t = ui;
      for (ui = void 0; t; ) {
        const n = t.next;
        t.next = void 0, t.flags &= -9, t = n;
      }
    }
    let e;
    for (; ci; ) {
      let t = ci;
      for (ci = void 0; t; ) {
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
  function qr(e) {
    for (let t = e.deps; t; t = t.nextDep)
      t.version = -1, t.prevActiveLink = t.dep.activeLink, t.dep.activeLink = t;
  }
  function jr(e) {
    let t, n = e.depsTail, i = n;
    for (; i; ) {
      const s = i.prevDep;
      i.version === -1 ? (i === n && (n = s), Io(i), Zu(i)) : t = i, i.dep.activeLink = i.prevActiveLink, i.prevActiveLink = void 0, i = s;
    }
    e.deps = t, e.depsTail = n;
  }
  function Ys(e) {
    for (let t = e.deps; t; t = t.nextDep)
      if (t.dep.version !== t.version || t.dep.computed && (Zr(t.dep.computed) || t.dep.version !== t.version))
        return !0;
    return !!e._dirty;
  }
  function Zr(e) {
    if (e.flags & 4 && !(e.flags & 16) || (e.flags &= -17, e.globalVersion === hi) || (e.globalVersion = hi, !e.isSSR && e.flags & 128 && (!e.deps && !e._dirty || !Ys(e))))
      return;
    e.flags |= 2;
    const t = e.dep, n = Ue, i = Mt;
    Ue = e, Mt = !0;
    try {
      qr(e);
      const s = e.fn(e._value);
      (t.version === 0 || jt(s, e._value)) && (e.flags |= 128, e._value = s, t.version++);
    } catch (s) {
      throw t.version++, s;
    } finally {
      Ue = n, Mt = i, jr(e), e.flags &= -3;
    }
  }
  function Io(e, t = !1) {
    const { dep: n, prevSub: i, nextSub: s } = e;
    if (i && (i.nextSub = s, e.prevSub = void 0), s && (s.prevSub = i, e.nextSub = void 0), n.subs === e && (n.subs = i, !i && n.computed)) {
      n.computed.flags &= -5;
      for (let a = n.computed.deps; a; a = a.nextDep)
        Io(a, !0);
    }
    !t && !--n.sc && n.map && n.map.delete(n.key);
  }
  function Zu(e) {
    const { prevDep: t, nextDep: n } = e;
    t && (t.nextDep = n, e.prevDep = void 0), n && (n.prevDep = t, e.nextDep = void 0);
  }
  let Mt = !0;
  const Hr = [];
  function Jt() {
    Hr.push(Mt), Mt = !1;
  }
  function Xt() {
    const e = Hr.pop();
    Mt = e === void 0 ? !0 : e;
  }
  function Ta(e) {
    const { cleanup: t } = e;
    if (e.cleanup = void 0, t) {
      const n = Ue;
      Ue = void 0;
      try {
        t();
      } finally {
        Ue = n;
      }
    }
  }
  let hi = 0;
  class Hu {
    constructor(t, n) {
      this.sub = t, this.dep = n, this.version = n.version, this.nextDep = this.prevDep = this.nextSub = this.prevSub = this.prevActiveLink = void 0;
    }
  }
  class $o {
    // TODO isolatedDeclarations "__v_skip"
    constructor(t) {
      this.computed = t, this.version = 0, this.activeLink = void 0, this.subs = void 0, this.map = void 0, this.key = void 0, this.sc = 0, this.__v_skip = !0;
    }
    track(t) {
      if (!Ue || !Mt || Ue === this.computed)
        return;
      let n = this.activeLink;
      if (n === void 0 || n.sub !== Ue)
        n = this.activeLink = new Hu(Ue, this), Ue.deps ? (n.prevDep = Ue.depsTail, Ue.depsTail.nextDep = n, Ue.depsTail = n) : Ue.deps = Ue.depsTail = n, Br(n);
      else if (n.version === -1 && (n.version = this.version, n.nextDep)) {
        const i = n.nextDep;
        i.prevDep = n.prevDep, n.prevDep && (n.prevDep.nextDep = i), n.prevDep = Ue.depsTail, n.nextDep = void 0, Ue.depsTail.nextDep = n, Ue.depsTail = n, Ue.deps === n && (Ue.deps = i);
      }
      return n;
    }
    trigger(t) {
      this.version++, hi++, this.notify(t);
    }
    notify(t) {
      Co();
      try {
        for (let n = this.subs; n; n = n.prevSub)
          n.sub.notify() && n.sub.dep.notify();
      } finally {
        Ao();
      }
    }
  }
  function Br(e) {
    if (e.dep.sc++, e.sub.flags & 4) {
      const t = e.dep.computed;
      if (t && !e.dep.subs) {
        t.flags |= 20;
        for (let i = t.deps; i; i = i.nextDep)
          Br(i);
      }
      const n = e.dep.subs;
      n !== e && (e.prevSub = n, n && (n.nextSub = e)), e.dep.subs = e;
    }
  }
  const eo = /* @__PURE__ */ new WeakMap(), Cn = /* @__PURE__ */ Symbol(
    ""
  ), to = /* @__PURE__ */ Symbol(
    ""
  ), gi = /* @__PURE__ */ Symbol(
    ""
  );
  function st(e, t, n) {
    if (Mt && Ue) {
      let i = eo.get(e);
      i || eo.set(e, i = /* @__PURE__ */ new Map());
      let s = i.get(n);
      s || (i.set(n, s = new $o()), s.map = i, s.key = n), s.track();
    }
  }
  function Gt(e, t, n, i, s, a) {
    const r = eo.get(e);
    if (!r) {
      hi++;
      return;
    }
    const c = (f) => {
      f && f.trigger();
    };
    if (Co(), t === "clear")
      r.forEach(c);
    else {
      const f = Ce(e), m = f && ko(n);
      if (f && n === "length") {
        const h = Number(i);
        r.forEach((w, C) => {
          (C === "length" || C === gi || !Bt(C) && C >= h) && c(w);
        });
      } else
        switch ((n !== void 0 || r.has(void 0)) && c(r.get(n)), m && c(r.get(gi)), t) {
          case "add":
            f ? m && c(r.get("length")) : (c(r.get(Cn)), qn(e) && c(r.get(to)));
            break;
          case "delete":
            f || (c(r.get(Cn)), qn(e) && c(r.get(to)));
            break;
          case "set":
            qn(e) && c(r.get(Cn));
            break;
        }
    }
    Ao();
  }
  function Ln(e) {
    const t = /* @__PURE__ */ Le(e);
    return t === e ? t : (st(t, "iterate", gi), /* @__PURE__ */ xt(e) ? t : t.map(Tt));
  }
  function ds(e) {
    return st(e = /* @__PURE__ */ Le(e), "iterate", gi), e;
  }
  function Ft(e, t) {
    return /* @__PURE__ */ Yt(e) ? Bn(/* @__PURE__ */ An(e) ? Tt(t) : t) : Tt(t);
  }
  const Bu = {
    __proto__: null,
    [Symbol.iterator]() {
      return qs(this, Symbol.iterator, (e) => Ft(this, e));
    },
    concat(...e) {
      return Ln(this).concat(
        ...e.map((t) => Ce(t) ? Ln(t) : t)
      );
    },
    entries() {
      return qs(this, "entries", (e) => (e[1] = Ft(this, e[1]), e));
    },
    every(e, t) {
      return Ut(this, "every", e, t, void 0, arguments);
    },
    filter(e, t) {
      return Ut(
        this,
        "filter",
        e,
        t,
        (n) => n.map((i) => Ft(this, i)),
        arguments
      );
    },
    find(e, t) {
      return Ut(
        this,
        "find",
        e,
        t,
        (n) => Ft(this, n),
        arguments
      );
    },
    findIndex(e, t) {
      return Ut(this, "findIndex", e, t, void 0, arguments);
    },
    findLast(e, t) {
      return Ut(
        this,
        "findLast",
        e,
        t,
        (n) => Ft(this, n),
        arguments
      );
    },
    findLastIndex(e, t) {
      return Ut(this, "findLastIndex", e, t, void 0, arguments);
    },
    // flat, flatMap could benefit from ARRAY_ITERATE but are not straight-forward to implement
    forEach(e, t) {
      return Ut(this, "forEach", e, t, void 0, arguments);
    },
    includes(...e) {
      return js(this, "includes", e);
    },
    indexOf(...e) {
      return js(this, "indexOf", e);
    },
    join(e) {
      return Ln(this).join(e);
    },
    // keys() iterator only reads `length`, no optimization required
    lastIndexOf(...e) {
      return js(this, "lastIndexOf", e);
    },
    map(e, t) {
      return Ut(this, "map", e, t, void 0, arguments);
    },
    pop() {
      return ei(this, "pop");
    },
    push(...e) {
      return ei(this, "push", e);
    },
    reduce(e, ...t) {
      return Pa(this, "reduce", e, t);
    },
    reduceRight(e, ...t) {
      return Pa(this, "reduceRight", e, t);
    },
    shift() {
      return ei(this, "shift");
    },
    // slice could use ARRAY_ITERATE but also seems to beg for range tracking
    some(e, t) {
      return Ut(this, "some", e, t, void 0, arguments);
    },
    splice(...e) {
      return ei(this, "splice", e);
    },
    toReversed() {
      return Ln(this).toReversed();
    },
    toSorted(e) {
      return Ln(this).toSorted(e);
    },
    toSpliced(...e) {
      return Ln(this).toSpliced(...e);
    },
    unshift(...e) {
      return ei(this, "unshift", e);
    },
    values() {
      return qs(this, "values", (e) => Ft(this, e));
    }
  };
  function qs(e, t, n) {
    const i = ds(e), s = i[t]();
    return i !== e && !/* @__PURE__ */ xt(e) && (s._next = s.next, s.next = () => {
      const a = s._next();
      return a.done || (a.value = n(a.value)), a;
    }), s;
  }
  const Vu = Array.prototype;
  function Ut(e, t, n, i, s, a) {
    const r = ds(e), c = r !== e && !/* @__PURE__ */ xt(e), f = r[t];
    if (f !== Vu[t]) {
      const w = f.apply(e, a);
      return c ? Tt(w) : w;
    }
    let m = n;
    r !== e && (c ? m = function(w, C) {
      return n.call(this, Ft(e, w), C, e);
    } : n.length > 2 && (m = function(w, C) {
      return n.call(this, w, C, e);
    }));
    const h = f.call(r, m, i);
    return c && s ? s(h) : h;
  }
  function Pa(e, t, n, i) {
    const s = ds(e), a = s !== e && !/* @__PURE__ */ xt(e);
    let r = n, c = !1;
    s !== e && (a ? (c = i.length === 0, r = function(m, h, w) {
      return c && (c = !1, m = Ft(e, m)), n.call(this, m, Ft(e, h), w, e);
    }) : n.length > 3 && (r = function(m, h, w) {
      return n.call(this, m, h, w, e);
    }));
    const f = s[t](r, ...i);
    return c ? Ft(e, f) : f;
  }
  function js(e, t, n) {
    const i = /* @__PURE__ */ Le(e);
    st(i, "iterate", gi);
    const s = i[t](...n);
    return (s === -1 || s === !1) && /* @__PURE__ */ Eo(n[0]) ? (n[0] = /* @__PURE__ */ Le(n[0]), i[t](...n)) : s;
  }
  function ei(e, t, n = []) {
    Jt(), Co();
    const i = (/* @__PURE__ */ Le(e))[t].apply(e, n);
    return Ao(), Xt(), i;
  }
  const Uu = /* @__PURE__ */ _o("__proto__,__v_isRef,__isVue"), Vr = new Set(
    /* @__PURE__ */ Object.getOwnPropertyNames(Symbol).filter((e) => e !== "arguments" && e !== "caller").map((e) => Symbol[e]).filter(Bt)
  );
  function Wu(e) {
    Bt(e) || (e = String(e));
    const t = /* @__PURE__ */ Le(this);
    return st(t, "has", e), t.hasOwnProperty(e);
  }
  class Ur {
    constructor(t = !1, n = !1) {
      this._isReadonly = t, this._isShallow = n;
    }
    get(t, n, i) {
      if (n === "__v_skip") return t.__v_skip;
      const s = this._isReadonly, a = this._isShallow;
      if (n === "__v_isReactive")
        return !s;
      if (n === "__v_isReadonly")
        return s;
      if (n === "__v_isShallow")
        return a;
      if (n === "__v_raw")
        return i === (s ? a ? nd : Gr : a ? zr : Kr).get(t) || // receiver is not the reactive proxy, but has the same prototype
        // this means the receiver is a user proxy of the reactive proxy
        Object.getPrototypeOf(t) === Object.getPrototypeOf(i) ? t : void 0;
      const r = Ce(t);
      if (!s) {
        let f;
        if (r && (f = Bu[n]))
          return f;
        if (n === "hasOwnProperty")
          return Wu;
      }
      const c = Reflect.get(
        t,
        n,
        // if this is a proxy wrapping a ref, return methods using the raw ref
        // as receiver so that we don't have to call `toRaw` on the ref in all
        // its class methods
        /* @__PURE__ */ ot(t) ? t : i
      );
      if ((Bt(n) ? Vr.has(n) : Uu(n)) || (s || st(t, "get", n), a))
        return c;
      if (/* @__PURE__ */ ot(c)) {
        const f = r && ko(n) ? c : c.value;
        return s && qe(f) ? /* @__PURE__ */ io(f) : f;
      }
      return qe(c) ? s ? /* @__PURE__ */ io(c) : /* @__PURE__ */ To(c) : c;
    }
  }
  class Wr extends Ur {
    constructor(t = !1) {
      super(!1, t);
    }
    set(t, n, i, s) {
      let a = t[n];
      const r = Ce(t) && ko(n);
      if (!this._isShallow) {
        const m = /* @__PURE__ */ Yt(a);
        if (!/* @__PURE__ */ xt(i) && !/* @__PURE__ */ Yt(i) && (a = /* @__PURE__ */ Le(a), i = /* @__PURE__ */ Le(i)), !r && /* @__PURE__ */ ot(a) && !/* @__PURE__ */ ot(i))
          return m || (a.value = i), !0;
      }
      const c = r ? Number(n) < t.length : De(t, n), f = Reflect.set(
        t,
        n,
        i,
        /* @__PURE__ */ ot(t) ? t : s
      );
      return t === /* @__PURE__ */ Le(s) && (c ? jt(i, a) && Gt(t, "set", n, i) : Gt(t, "add", n, i)), f;
    }
    deleteProperty(t, n) {
      const i = De(t, n);
      t[n];
      const s = Reflect.deleteProperty(t, n);
      return s && i && Gt(t, "delete", n, void 0), s;
    }
    has(t, n) {
      const i = Reflect.has(t, n);
      return (!Bt(n) || !Vr.has(n)) && st(t, "has", n), i;
    }
    ownKeys(t) {
      return st(
        t,
        "iterate",
        Ce(t) ? "length" : Cn
      ), Reflect.ownKeys(t);
    }
  }
  class Ku extends Ur {
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
  const zu = /* @__PURE__ */ new Wr(), Gu = /* @__PURE__ */ new Ku(), Qu = /* @__PURE__ */ new Wr(!0), no = (e) => e, ji = (e) => Reflect.getPrototypeOf(e);
  function Ju(e, t, n) {
    return function(...i) {
      const s = this.__v_raw, a = /* @__PURE__ */ Le(s), r = qn(a), c = e === "entries" || e === Symbol.iterator && r, f = e === "keys" && r, m = s[e](...i), h = n ? no : t ? Bn : Tt;
      return !t && st(
        a,
        "iterate",
        f ? to : Cn
      ), Ye(
        // inheriting all iterator properties
        Object.create(m),
        {
          // iterator protocol
          next() {
            const { value: w, done: C } = m.next();
            return C ? { value: w, done: C } : {
              value: c ? [h(w[0]), h(w[1])] : h(w),
              done: C
            };
          }
        }
      );
    };
  }
  function Zi(e) {
    return function(...t) {
      return e === "delete" ? !1 : e === "clear" ? void 0 : this;
    };
  }
  function Xu(e, t) {
    const n = {
      get(s) {
        const a = this.__v_raw, r = /* @__PURE__ */ Le(a), c = /* @__PURE__ */ Le(s);
        e || (jt(s, c) && st(r, "get", s), st(r, "get", c));
        const { has: f } = ji(r), m = t ? no : e ? Bn : Tt;
        if (f.call(r, s))
          return m(a.get(s));
        if (f.call(r, c))
          return m(a.get(c));
        a !== r && a.get(s);
      },
      get size() {
        const s = this.__v_raw;
        return !e && st(/* @__PURE__ */ Le(s), "iterate", Cn), s.size;
      },
      has(s) {
        const a = this.__v_raw, r = /* @__PURE__ */ Le(a), c = /* @__PURE__ */ Le(s);
        return e || (jt(s, c) && st(r, "has", s), st(r, "has", c)), s === c ? a.has(s) : a.has(s) || a.has(c);
      },
      forEach(s, a) {
        const r = this, c = r.__v_raw, f = /* @__PURE__ */ Le(c), m = t ? no : e ? Bn : Tt;
        return !e && st(f, "iterate", Cn), c.forEach((h, w) => s.call(a, m(h), m(w), r));
      }
    };
    return Ye(
      n,
      e ? {
        add: Zi("add"),
        set: Zi("set"),
        delete: Zi("delete"),
        clear: Zi("clear")
      } : {
        add(s) {
          const a = /* @__PURE__ */ Le(this), r = ji(a), c = /* @__PURE__ */ Le(s), f = !t && !/* @__PURE__ */ xt(s) && !/* @__PURE__ */ Yt(s) ? c : s;
          return r.has.call(a, f) || jt(s, f) && r.has.call(a, s) || jt(c, f) && r.has.call(a, c) || (a.add(f), Gt(a, "add", f, f)), this;
        },
        set(s, a) {
          !t && !/* @__PURE__ */ xt(a) && !/* @__PURE__ */ Yt(a) && (a = /* @__PURE__ */ Le(a));
          const r = /* @__PURE__ */ Le(this), { has: c, get: f } = ji(r);
          let m = c.call(r, s);
          m || (s = /* @__PURE__ */ Le(s), m = c.call(r, s));
          const h = f.call(r, s);
          return r.set(s, a), m ? jt(a, h) && Gt(r, "set", s, a) : Gt(r, "add", s, a), this;
        },
        delete(s) {
          const a = /* @__PURE__ */ Le(this), { has: r, get: c } = ji(a);
          let f = r.call(a, s);
          f || (s = /* @__PURE__ */ Le(s), f = r.call(a, s)), c && c.call(a, s);
          const m = a.delete(s);
          return f && Gt(a, "delete", s, void 0), m;
        },
        clear() {
          const s = /* @__PURE__ */ Le(this), a = s.size !== 0, r = s.clear();
          return a && Gt(
            s,
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
    ].forEach((s) => {
      n[s] = Ju(s, e, t);
    }), n;
  }
  function Mo(e, t) {
    const n = Xu(e, t);
    return (i, s, a) => s === "__v_isReactive" ? !e : s === "__v_isReadonly" ? e : s === "__v_raw" ? i : Reflect.get(
      De(n, s) && s in i ? n : i,
      s,
      a
    );
  }
  const Yu = {
    get: /* @__PURE__ */ Mo(!1, !1)
  }, ed = {
    get: /* @__PURE__ */ Mo(!1, !0)
  }, td = {
    get: /* @__PURE__ */ Mo(!0, !1)
  }, Kr = /* @__PURE__ */ new WeakMap(), zr = /* @__PURE__ */ new WeakMap(), Gr = /* @__PURE__ */ new WeakMap(), nd = /* @__PURE__ */ new WeakMap();
  function id(e) {
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
  function sd(e) {
    return e.__v_skip || !Object.isExtensible(e) ? 0 : id($u(e));
  }
  // @__NO_SIDE_EFFECTS__
  function To(e) {
    return /* @__PURE__ */ Yt(e) ? e : Po(
      e,
      !1,
      zu,
      Yu,
      Kr
    );
  }
  // @__NO_SIDE_EFFECTS__
  function od(e) {
    return Po(
      e,
      !1,
      Qu,
      ed,
      zr
    );
  }
  // @__NO_SIDE_EFFECTS__
  function io(e) {
    return Po(
      e,
      !0,
      Gu,
      td,
      Gr
    );
  }
  function Po(e, t, n, i, s) {
    if (!qe(e) || e.__v_raw && !(t && e.__v_isReactive))
      return e;
    const a = sd(e);
    if (a === 0)
      return e;
    const r = s.get(e);
    if (r)
      return r;
    const c = new Proxy(
      e,
      a === 2 ? i : n
    );
    return s.set(e, c), c;
  }
  // @__NO_SIDE_EFFECTS__
  function An(e) {
    return /* @__PURE__ */ Yt(e) ? /* @__PURE__ */ An(e.__v_raw) : !!(e && e.__v_isReactive);
  }
  // @__NO_SIDE_EFFECTS__
  function Yt(e) {
    return !!(e && e.__v_isReadonly);
  }
  // @__NO_SIDE_EFFECTS__
  function xt(e) {
    return !!(e && e.__v_isShallow);
  }
  // @__NO_SIDE_EFFECTS__
  function Eo(e) {
    return e ? !!e.__v_raw : !1;
  }
  // @__NO_SIDE_EFFECTS__
  function Le(e) {
    const t = e && e.__v_raw;
    return t ? /* @__PURE__ */ Le(t) : e;
  }
  function ad(e) {
    return !De(e, "__v_skip") && Object.isExtensible(e) && Er(e, "__v_skip", !0), e;
  }
  const Tt = (e) => qe(e) ? /* @__PURE__ */ To(e) : e, Bn = (e) => qe(e) ? /* @__PURE__ */ io(e) : e;
  // @__NO_SIDE_EFFECTS__
  function ot(e) {
    return e ? e.__v_isRef === !0 : !1;
  }
  // @__NO_SIDE_EFFECTS__
  function G(e) {
    return rd(e, !1);
  }
  function rd(e, t) {
    return /* @__PURE__ */ ot(e) ? e : new ld(e, t);
  }
  class ld {
    constructor(t, n) {
      this.dep = new $o(), this.__v_isRef = !0, this.__v_isShallow = !1, this._rawValue = n ? t : /* @__PURE__ */ Le(t), this._value = n ? t : Tt(t), this.__v_isShallow = n;
    }
    get value() {
      return this.dep.track(), this._value;
    }
    set value(t) {
      const n = this._rawValue, i = this.__v_isShallow || /* @__PURE__ */ xt(t) || /* @__PURE__ */ Yt(t);
      t = i ? t : /* @__PURE__ */ Le(t), jt(t, n) && (this._rawValue = t, this._value = i ? t : Tt(t), this.dep.trigger());
    }
  }
  function Qe(e) {
    return /* @__PURE__ */ ot(e) ? e.value : e;
  }
  const cd = {
    get: (e, t, n) => t === "__v_raw" ? e : Qe(Reflect.get(e, t, n)),
    set: (e, t, n, i) => {
      const s = e[t];
      return /* @__PURE__ */ ot(s) && !/* @__PURE__ */ ot(n) ? (s.value = n, !0) : Reflect.set(e, t, n, i);
    }
  };
  function Qr(e) {
    return /* @__PURE__ */ An(e) ? e : new Proxy(e, cd);
  }
  class ud {
    constructor(t, n, i) {
      this.fn = t, this.setter = n, this._value = void 0, this.dep = new $o(this), this.__v_isRef = !0, this.deps = void 0, this.depsTail = void 0, this.flags = 16, this.globalVersion = hi - 1, this.next = void 0, this.effect = this, this.__v_isReadonly = !n, this.isSSR = i;
    }
    /**
     * @internal
     */
    notify() {
      if (this.flags |= 16, !(this.flags & 8) && // avoid infinite self recursion
      Ue !== this)
        return Fr(this, !0), !0;
    }
    get value() {
      const t = this.dep.track();
      return Zr(this), t && (t.version = this.dep.version), this._value;
    }
    set value(t) {
      this.setter && this.setter(t);
    }
  }
  // @__NO_SIDE_EFFECTS__
  function dd(e, t, n = !1) {
    let i, s;
    return Ie(e) ? i = e : (i = e.get, s = e.set), new ud(i, s, n);
  }
  const Hi = {}, Gi = /* @__PURE__ */ new WeakMap();
  let wn;
  function fd(e, t = !1, n = wn) {
    if (n) {
      let i = Gi.get(n);
      i || Gi.set(n, i = []), i.push(e);
    }
  }
  function vd(e, t, n = Be) {
    const { immediate: i, deep: s, once: a, scheduler: r, augmentJob: c, call: f } = n, m = (ie) => s ? ie : /* @__PURE__ */ xt(ie) || s === !1 || s === 0 ? Qt(ie, 1) : Qt(ie);
    let h, w, C, A, R = !1, P = !1;
    if (/* @__PURE__ */ ot(e) ? (w = () => e.value, R = /* @__PURE__ */ xt(e)) : /* @__PURE__ */ An(e) ? (w = () => m(e), R = !0) : Ce(e) ? (P = !0, R = e.some((ie) => /* @__PURE__ */ An(ie) || /* @__PURE__ */ xt(ie)), w = () => e.map((ie) => {
      if (/* @__PURE__ */ ot(ie))
        return ie.value;
      if (/* @__PURE__ */ An(ie))
        return m(ie);
      if (Ie(ie))
        return f ? f(ie, 2) : ie();
    })) : Ie(e) ? t ? w = f ? () => f(e, 2) : e : w = () => {
      if (C) {
        Jt();
        try {
          C();
        } finally {
          Xt();
        }
      }
      const ie = wn;
      wn = h;
      try {
        return f ? f(e, 3, [A]) : e(A);
      } finally {
        wn = ie;
      }
    } : w = Ht, t && s) {
      const ie = w, he = s === !0 ? 1 / 0 : s;
      w = () => Qt(ie(), he);
    }
    const E = ju(), Z = () => {
      h.stop(), E && E.active && wo(E.effects, h);
    };
    if (a && t) {
      const ie = t;
      t = (...he) => {
        ie(...he), Z();
      };
    }
    let I = P ? new Array(e.length).fill(Hi) : Hi;
    const V = (ie) => {
      if (!(!(h.flags & 1) || !h.dirty && !ie))
        if (t) {
          const he = h.run();
          if (s || R || (P ? he.some((Se, de) => jt(Se, I[de])) : jt(he, I))) {
            C && C();
            const Se = wn;
            wn = h;
            try {
              const de = [
                he,
                // pass undefined as the old value when it's changed for the first time
                I === Hi ? void 0 : P && I[0] === Hi ? [] : I,
                A
              ];
              I = he, f ? f(t, 3, de) : (
                // @ts-expect-error
                t(...de)
              );
            } finally {
              wn = Se;
            }
          }
        } else
          h.run();
    };
    return c && c(V), h = new Or(w), h.scheduler = r ? () => r(V, !1) : V, A = (ie) => fd(ie, !1, h), C = h.onStop = () => {
      const ie = Gi.get(h);
      if (ie) {
        if (f)
          f(ie, 4);
        else
          for (const he of ie) he();
        Gi.delete(h);
      }
    }, t ? i ? V(!0) : I = h.run() : r ? r(V.bind(null, !0), !0) : h.run(), Z.pause = h.pause.bind(h), Z.resume = h.resume.bind(h), Z.stop = Z, Z;
  }
  function Qt(e, t = 1 / 0, n) {
    if (t <= 0 || !qe(e) || e.__v_skip || (n = n || /* @__PURE__ */ new Map(), (n.get(e) || 0) >= t))
      return e;
    if (n.set(e, t), t--, /* @__PURE__ */ ot(e))
      Qt(e.value, t, n);
    else if (Ce(e))
      for (let i = 0; i < e.length; i++)
        Qt(e[i], t, n);
    else if (Ir(e) || qn(e))
      e.forEach((i) => {
        Qt(i, t, n);
      });
    else if (Tr(e)) {
      for (const i in e)
        Qt(e[i], t, n);
      for (const i of Object.getOwnPropertySymbols(e))
        Object.prototype.propertyIsEnumerable.call(e, i) && Qt(e[i], t, n);
    }
    return e;
  }
  function xi(e, t, n, i) {
    try {
      return i ? e(...i) : e();
    } catch (s) {
      fs(s, t, n);
    }
  }
  function Pt(e, t, n, i) {
    if (Ie(e)) {
      const s = xi(e, t, n, i);
      return s && $r(s) && s.catch((a) => {
        fs(a, t, n);
      }), s;
    }
    if (Ce(e)) {
      const s = [];
      for (let a = 0; a < e.length; a++)
        s.push(Pt(e[a], t, n, i));
      return s;
    }
  }
  function fs(e, t, n, i = !0) {
    const s = t ? t.vnode : null, { errorHandler: a, throwUnhandledErrorInProduction: r } = t && t.appContext.config || Be;
    if (t) {
      let c = t.parent;
      const f = t.proxy, m = `https://vuejs.org/error-reference/#runtime-${n}`;
      for (; c; ) {
        const h = c.ec;
        if (h) {
          for (let w = 0; w < h.length; w++)
            if (h[w](e, f, m) === !1)
              return;
        }
        c = c.parent;
      }
      if (a) {
        Jt(), xi(a, null, 10, [
          e,
          f,
          m
        ]), Xt();
        return;
      }
    }
    pd(e, n, s, i, r);
  }
  function pd(e, t, n, i = !0, s = !1) {
    if (s)
      throw e;
    console.error(e);
  }
  const ut = [];
  let Ot = -1;
  const jn = [];
  let ln = null, On = 0;
  const Jr = /* @__PURE__ */ Promise.resolve();
  let Qi = null;
  function nt(e) {
    const t = Qi || Jr;
    return e ? t.then(this ? e.bind(this) : e) : t;
  }
  function hd(e) {
    let t = Ot + 1, n = ut.length;
    for (; t < n; ) {
      const i = t + n >>> 1, s = ut[i], a = mi(s);
      a < e || a === e && s.flags & 2 ? t = i + 1 : n = i;
    }
    return t;
  }
  function Ro(e) {
    if (!(e.flags & 1)) {
      const t = mi(e), n = ut[ut.length - 1];
      !n || // fast path when the job id is larger than the tail
      !(e.flags & 2) && t >= mi(n) ? ut.push(e) : ut.splice(hd(t), 0, e), e.flags |= 1, Xr();
    }
  }
  function Xr() {
    Qi || (Qi = Jr.then(el));
  }
  function gd(e) {
    Ce(e) ? jn.push(...e) : ln && e.id === -1 ? ln.splice(On + 1, 0, e) : e.flags & 1 || (jn.push(e), e.flags |= 1), Xr();
  }
  function Ea(e, t, n = Ot + 1) {
    for (; n < ut.length; n++) {
      const i = ut[n];
      if (i && i.flags & 2) {
        if (e && i.id !== e.uid)
          continue;
        ut.splice(n, 1), n--, i.flags & 4 && (i.flags &= -2), i(), i.flags & 4 || (i.flags &= -2);
      }
    }
  }
  function Yr(e) {
    if (jn.length) {
      const t = [...new Set(jn)].sort(
        (n, i) => mi(n) - mi(i)
      );
      if (jn.length = 0, ln) {
        ln.push(...t);
        return;
      }
      for (ln = t, On = 0; On < ln.length; On++) {
        const n = ln[On];
        n.flags & 4 && (n.flags &= -2), n.flags & 8 || n(), n.flags &= -2;
      }
      ln = null, On = 0;
    }
  }
  const mi = (e) => e.id == null ? e.flags & 2 ? -1 : 1 / 0 : e.id;
  function el(e) {
    try {
      for (Ot = 0; Ot < ut.length; Ot++) {
        const t = ut[Ot];
        t && !(t.flags & 8) && (t.flags & 4 && (t.flags &= -2), xi(
          t,
          t.i,
          t.i ? 15 : 14
        ), t.flags & 4 || (t.flags &= -2));
      }
    } finally {
      for (; Ot < ut.length; Ot++) {
        const t = ut[Ot];
        t && (t.flags &= -2);
      }
      Ot = -1, ut.length = 0, Yr(), Qi = null, (ut.length || jn.length) && el();
    }
  }
  let kt = null, tl = null;
  function Ji(e) {
    const t = kt;
    return kt = e, tl = e && e.type.__scopeId || null, t;
  }
  function wt(e, t = kt, n) {
    if (!t || e._n)
      return e;
    const i = (...s) => {
      i._d && es(-1);
      const a = Ji(t);
      let r;
      try {
        r = e(...s);
      } finally {
        Ji(a), i._d && es(1);
      }
      return r;
    };
    return i._n = !0, i._c = !0, i._d = !0, i;
  }
  function Rt(e, t) {
    if (kt === null)
      return e;
    const n = ms(kt), i = e.dirs || (e.dirs = []);
    for (let s = 0; s < t.length; s++) {
      let [a, r, c, f = Be] = t[s];
      a && (Ie(a) && (a = {
        mounted: a,
        updated: a
      }), a.deep && Qt(r), i.push({
        dir: a,
        instance: n,
        value: r,
        oldValue: void 0,
        arg: c,
        modifiers: f
      }));
    }
    return e;
  }
  function mn(e, t, n, i) {
    const s = e.dirs, a = t && t.dirs;
    for (let r = 0; r < s.length; r++) {
      const c = s[r];
      a && (c.oldValue = a[r].value);
      let f = c.dir[i];
      f && (Jt(), Pt(f, n, 8, [
        e.el,
        c,
        e,
        t
      ]), Xt());
    }
  }
  function md(e, t) {
    if (ft) {
      let n = ft.provides;
      const i = ft.parent && ft.parent.provides;
      i === n && (n = ft.provides = Object.create(i)), n[e] = t;
    }
  }
  function Ui(e, t, n = !1) {
    const i = jo();
    if (i || Zn) {
      let s = Zn ? Zn._context.provides : i ? i.parent == null || i.ce ? i.vnode.appContext && i.vnode.appContext.provides : i.parent.provides : void 0;
      if (s && e in s)
        return s[e];
      if (arguments.length > 1)
        return n && Ie(t) ? t.call(i && i.proxy) : t;
    }
  }
  const yd = /* @__PURE__ */ Symbol.for("v-scx"), bd = () => Ui(yd);
  function vt(e, t, n) {
    return nl(e, t, n);
  }
  function nl(e, t, n = Be) {
    const { immediate: i, deep: s, flush: a, once: r } = n, c = Ye({}, n), f = t && i || !t && a !== "post";
    let m;
    if (_i) {
      if (a === "sync") {
        const A = bd();
        m = A.__watcherHandles || (A.__watcherHandles = []);
      } else if (!f) {
        const A = () => {
        };
        return A.stop = Ht, A.resume = Ht, A.pause = Ht, A;
      }
    }
    const h = ft;
    c.call = (A, R, P) => Pt(A, h, R, P);
    let w = !1;
    a === "post" ? c.scheduler = (A) => {
      ct(A, h && h.suspense);
    } : a !== "sync" && (w = !0, c.scheduler = (A, R) => {
      R ? A() : Ro(A);
    }), c.augmentJob = (A) => {
      t && (A.flags |= 4), w && (A.flags |= 2, h && (A.id = h.uid, A.i = h));
    };
    const C = vd(e, t, c);
    return _i && (m ? m.push(C) : f && C()), C;
  }
  function _d(e, t, n) {
    const i = this.proxy, s = ze(e) ? e.includes(".") ? il(i, e) : () => i[e] : e.bind(i, i);
    let a;
    Ie(t) ? a = t : (a = t.handler, n = t);
    const r = Si(this), c = nl(s, a.bind(i), n);
    return r(), c;
  }
  function il(e, t) {
    const n = t.split(".");
    return () => {
      let i = e;
      for (let s = 0; s < n.length && i; s++)
        i = i[n[s]];
      return i;
    };
  }
  const rn = /* @__PURE__ */ new WeakMap(), sl = /* @__PURE__ */ Symbol("_vte"), ol = (e) => e.__isTeleport, kn = (e) => e && (e.disabled || e.disabled === ""), wd = (e) => e && (e.defer || e.defer === ""), Ra = (e) => typeof SVGElement < "u" && e instanceof SVGElement, Na = (e) => typeof MathMLElement == "function" && e instanceof MathMLElement, so = (e, t) => {
    const n = e && e.to;
    return ze(n) ? t ? t(n) : null : n;
  }, kd = {
    name: "Teleport",
    __isTeleport: !0,
    process(e, t, n, i, s, a, r, c, f, m) {
      const {
        mc: h,
        pc: w,
        pbc: C,
        o: { insert: A, querySelector: R, createText: P, createComment: E, parentNode: Z }
      } = m, I = kn(t.props);
      let { dynamicChildren: V } = t;
      const ie = (de, ve, oe) => {
        de.shapeFlag & 16 && h(
          de.children,
          ve,
          oe,
          s,
          a,
          r,
          c,
          f
        );
      }, he = (de = t) => {
        const ve = kn(de.props), oe = de.target = so(de.props, R), me = oo(oe, de, P, A);
        oe && (r !== "svg" && Ra(oe) ? r = "svg" : r !== "mathml" && Na(oe) && (r = "mathml"), s && s.isCE && (s.ce._teleportTargets || (s.ce._teleportTargets = /* @__PURE__ */ new Set())).add(oe), ve || (ie(de, oe, me), si(de, !1)));
      }, Se = (de) => {
        const ve = () => {
          if (rn.get(de) === ve) {
            if (rn.delete(de), kn(de.props)) {
              const oe = Z(de.el) || n;
              ie(de, oe, de.anchor), si(de, !0);
            }
            he(de);
          }
        };
        rn.set(de, ve), ct(ve, a);
      };
      if (e == null) {
        const de = t.el = P(""), ve = t.anchor = P("");
        if (A(de, n, i), A(ve, n, i), wd(t.props) || a && a.pendingBranch) {
          Se(t);
          return;
        }
        I && (ie(t, n, ve), si(t, !0)), he();
      } else {
        t.el = e.el;
        const de = t.anchor = e.anchor, ve = rn.get(e);
        if (ve) {
          ve.flags |= 8, rn.delete(e), Se(t);
          return;
        }
        t.targetStart = e.targetStart;
        const oe = t.target = e.target, me = t.targetAnchor = e.targetAnchor, _e = kn(e.props), b = _e ? n : oe, T = _e ? de : me;
        if (r === "svg" || Ra(oe) ? r = "svg" : (r === "mathml" || Na(oe)) && (r = "mathml"), V ? (C(
          e.dynamicChildren,
          V,
          b,
          s,
          a,
          r,
          c
        ), Fo(e, t, !0)) : f || w(
          e,
          t,
          b,
          T,
          s,
          a,
          r,
          c,
          !1
        ), I)
          _e ? t.props && e.props && t.props.to !== e.props.to && (t.props.to = e.props.to) : Bi(
            t,
            n,
            de,
            m,
            1
          );
        else if ((t.props && t.props.to) !== (e.props && e.props.to)) {
          const S = t.target = so(
            t.props,
            R
          );
          S && Bi(
            t,
            S,
            null,
            m,
            0
          );
        } else _e && Bi(
          t,
          oe,
          me,
          m,
          1
        );
        si(t, I);
      }
    },
    remove(e, t, n, { um: i, o: { remove: s } }, a) {
      const {
        shapeFlag: r,
        children: c,
        anchor: f,
        targetStart: m,
        targetAnchor: h,
        target: w,
        props: C
      } = e;
      let A = a || !kn(C);
      const R = rn.get(e);
      if (R && (R.flags |= 8, rn.delete(e), A = !1), w && (s(m), s(h)), a && s(f), r & 16)
        for (let P = 0; P < c.length; P++) {
          const E = c[P];
          i(
            E,
            t,
            n,
            A,
            !!E.dynamicChildren
          );
        }
    },
    move: Bi,
    hydrate: xd
  };
  function Bi(e, t, n, { o: { insert: i }, m: s }, a = 2) {
    a === 0 && i(e.targetAnchor, t, n);
    const { el: r, anchor: c, shapeFlag: f, children: m, props: h } = e, w = a === 2;
    if (w && i(r, t, n), !rn.has(e) && (!w || kn(h)) && f & 16)
      for (let C = 0; C < m.length; C++)
        s(
          m[C],
          t,
          n,
          2
        );
    w && i(c, t, n);
  }
  function xd(e, t, n, i, s, a, {
    o: { nextSibling: r, parentNode: c, querySelector: f, insert: m, createText: h }
  }, w) {
    function C(E, Z) {
      let I = Z;
      for (; I; ) {
        if (I && I.nodeType === 8) {
          if (I.data === "teleport start anchor")
            t.targetStart = I;
          else if (I.data === "teleport anchor") {
            t.targetAnchor = I, E._lpa = t.targetAnchor && r(t.targetAnchor);
            break;
          }
        }
        I = r(I);
      }
    }
    function A(E, Z) {
      Z.anchor = w(
        r(E),
        Z,
        c(E),
        n,
        i,
        s,
        a
      );
    }
    const R = t.target = so(
      t.props,
      f
    ), P = kn(t.props);
    if (R) {
      const E = R._lpa || R.firstChild;
      t.shapeFlag & 16 && (P ? (A(e, t), C(R, E), t.targetAnchor || oo(
        R,
        t,
        h,
        m,
        // if target is the same as the main view, insert anchors before current node
        // to avoid hydrating mismatch
        c(e) === R ? e : null
      )) : (t.anchor = r(e), C(R, E), t.targetAnchor || oo(R, t, h, m), w(
        E && r(E),
        t,
        R,
        n,
        i,
        s,
        a
      ))), si(t, P);
    } else P && t.shapeFlag & 16 && (A(e, t), t.targetStart = e, t.targetAnchor = r(e));
    return t.anchor && r(t.anchor);
  }
  const La = kd;
  function si(e, t) {
    const n = e.ctx;
    if (n && n.ut) {
      let i, s;
      for (t ? (i = e.el, s = e.anchor) : (i = e.targetStart, s = e.targetAnchor); i && i !== s; )
        i.nodeType === 1 && i.setAttribute("data-v-owner", n.uid), i = i.nextSibling;
      n.ut();
    }
  }
  function oo(e, t, n, i, s = null) {
    const a = t.targetStart = n(""), r = t.targetAnchor = n("");
    return a[sl] = r, e && (i(a, e, s), i(r, e, s)), r;
  }
  const Dt = /* @__PURE__ */ Symbol("_leaveCb"), ti = /* @__PURE__ */ Symbol("_enterCb");
  function Sd() {
    const e = {
      isMounted: !1,
      isLeaving: !1,
      isUnmounting: !1,
      leavingVNodes: /* @__PURE__ */ new Map()
    };
    return Un(() => {
      e.isMounted = !0;
    }), vn(() => {
      e.isUnmounting = !0;
    }), e;
  }
  const _t = [Function, Array], al = {
    mode: String,
    appear: Boolean,
    persisted: Boolean,
    // enter
    onBeforeEnter: _t,
    onEnter: _t,
    onAfterEnter: _t,
    onEnterCancelled: _t,
    // leave
    onBeforeLeave: _t,
    onLeave: _t,
    onAfterLeave: _t,
    onLeaveCancelled: _t,
    // appear
    onBeforeAppear: _t,
    onAppear: _t,
    onAfterAppear: _t,
    onAppearCancelled: _t
  }, rl = (e) => {
    const t = e.subTree;
    return t.component ? rl(t.component) : t;
  }, Cd = {
    name: "BaseTransition",
    props: al,
    setup(e, { slots: t }) {
      const n = jo(), i = Sd();
      return () => {
        const s = t.default && ul(t.default(), !0), a = s && s.length ? ll(s) : (
          // Keep explicit default-slot conditionals on the same transition path
          // as regular v-if branches, which render a comment placeholder.
          n.subTree ? x() : void 0
        );
        if (!a)
          return;
        const r = /* @__PURE__ */ Le(e), { mode: c } = r;
        if (i.isLeaving)
          return Zs(a);
        const f = Oa(a);
        if (!f)
          return Zs(a);
        let m = ao(
          f,
          r,
          i,
          n,
          // #11061, ensure enterHooks is fresh after clone
          (w) => m = w
        );
        f.type !== dt && yi(f, m);
        let h = n.subTree && Oa(n.subTree);
        if (h && h.type !== dt && !xn(h, f) && rl(n).type !== dt) {
          let w = ao(
            h,
            r,
            i,
            n
          );
          if (yi(h, w), c === "out-in" && f.type !== dt)
            return i.isLeaving = !0, w.afterLeave = () => {
              i.isLeaving = !1, n.job.flags & 8 || n.update(), delete w.afterLeave, h = void 0;
            }, Zs(a);
          c === "in-out" && f.type !== dt ? w.delayLeave = (C, A, R) => {
            const P = cl(
              i,
              h
            );
            P[String(h.key)] = h, C[Dt] = () => {
              A(), C[Dt] = void 0, delete m.delayedLeave, h = void 0;
            }, m.delayedLeave = () => {
              R(), delete m.delayedLeave, h = void 0;
            };
          } : h = void 0;
        } else h && (h = void 0);
        return a;
      };
    }
  };
  function ll(e) {
    let t = e[0];
    if (e.length > 1) {
      for (const n of e)
        if (n.type !== dt) {
          t = n;
          break;
        }
    }
    return t;
  }
  const Ad = Cd;
  function cl(e, t) {
    const { leavingVNodes: n } = e;
    let i = n.get(t.type);
    return i || (i = /* @__PURE__ */ Object.create(null), n.set(t.type, i)), i;
  }
  function ao(e, t, n, i, s) {
    const {
      appear: a,
      mode: r,
      persisted: c = !1,
      onBeforeEnter: f,
      onEnter: m,
      onAfterEnter: h,
      onEnterCancelled: w,
      onBeforeLeave: C,
      onLeave: A,
      onAfterLeave: R,
      onLeaveCancelled: P,
      onBeforeAppear: E,
      onAppear: Z,
      onAfterAppear: I,
      onAppearCancelled: V
    } = t, ie = String(e.key), he = cl(n, e), Se = (oe, me) => {
      oe && Pt(
        oe,
        i,
        9,
        me
      );
    }, de = (oe, me) => {
      const _e = me[1];
      Se(oe, me), Ce(oe) ? oe.every((b) => b.length <= 1) && _e() : oe.length <= 1 && _e();
    }, ve = {
      mode: r,
      persisted: c,
      beforeEnter(oe) {
        let me = f;
        if (!n.isMounted)
          if (a)
            me = E || f;
          else
            return;
        oe[Dt] && oe[Dt](
          !0
          /* cancelled */
        );
        const _e = he[ie];
        _e && xn(e, _e) && _e.el[Dt] && _e.el[Dt](), Se(me, [oe]);
      },
      enter(oe) {
        if (he[ie] === e) return;
        let me = m, _e = h, b = w;
        if (!n.isMounted)
          if (a)
            me = Z || m, _e = I || h, b = V || w;
          else
            return;
        let T = !1;
        oe[ti] = (K) => {
          T || (T = !0, K ? Se(b, [oe]) : Se(_e, [oe]), ve.delayedLeave && ve.delayedLeave(), oe[ti] = void 0);
        };
        const S = oe[ti].bind(null, !1);
        me ? de(me, [oe, S]) : S();
      },
      leave(oe, me) {
        const _e = String(e.key);
        if (oe[ti] && oe[ti](
          !0
          /* cancelled */
        ), n.isUnmounting)
          return me();
        Se(C, [oe]);
        let b = !1;
        oe[Dt] = (S) => {
          b || (b = !0, me(), S ? Se(P, [oe]) : Se(R, [oe]), oe[Dt] = void 0, he[_e] === e && delete he[_e]);
        };
        const T = oe[Dt].bind(null, !1);
        he[_e] = e, A ? de(A, [oe, T]) : T();
      },
      clone(oe) {
        const me = ao(
          oe,
          t,
          n,
          i,
          s
        );
        return s && s(me), me;
      }
    };
    return ve;
  }
  function Zs(e) {
    if (vs(e))
      return e = dn(e), e.children = null, e;
  }
  function Oa(e) {
    if (!vs(e))
      return ol(e.type) && e.children ? ll(e.children) : e;
    if (e.component)
      return e.component.subTree;
    const { shapeFlag: t, children: n } = e;
    if (n) {
      if (t & 16)
        return n[0];
      if (t & 32 && Ie(n.default))
        return n.default();
    }
  }
  function yi(e, t) {
    e.shapeFlag & 6 && e.component ? (e.transition = t, yi(e.component.subTree, t)) : e.shapeFlag & 128 ? (e.ssContent.transition = t.clone(e.ssContent), e.ssFallback.transition = t.clone(e.ssFallback)) : e.transition = t;
  }
  function ul(e, t = !1, n) {
    let i = [], s = 0;
    for (let a = 0; a < e.length; a++) {
      let r = e[a];
      const c = n == null ? r.key : String(n) + String(r.key != null ? r.key : a);
      r.type === ye ? (r.patchFlag & 128 && s++, i = i.concat(
        ul(r.children, t, c)
      )) : (t || r.type !== dt) && i.push(c != null ? dn(r, { key: c }) : r);
    }
    if (s > 1)
      for (let a = 0; a < i.length; a++)
        i[a].patchFlag = -2;
    return i;
  }
  function No() {
    const e = jo();
    return e ? (e.appContext.config.idPrefix || "v") + "-" + e.ids[0] + e.ids[1]++ : "";
  }
  function dl(e) {
    e.ids = [e.ids[0] + e.ids[2]++ + "-", 0, 0];
  }
  function Da(e, t) {
    let n;
    return !!((n = Object.getOwnPropertyDescriptor(e, t)) && !n.configurable);
  }
  const Xi = /* @__PURE__ */ new WeakMap();
  function di(e, t, n, i, s = !1) {
    if (Ce(e)) {
      e.forEach(
        (P, E) => di(
          P,
          t && (Ce(t) ? t[E] : t),
          n,
          i,
          s
        )
      );
      return;
    }
    if (fi(i) && !s) {
      i.shapeFlag & 512 && i.type.__asyncResolved && i.component.subTree.component && di(e, t, n, i.component.subTree);
      return;
    }
    const a = i.shapeFlag & 4 ? ms(i.component) : i.el, r = s ? null : a, { i: c, r: f } = e, m = t && t.r, h = c.refs === Be ? c.refs = {} : c.refs, w = c.setupState, C = /* @__PURE__ */ Le(w), A = w === Be ? Ar : (P) => Da(h, P) ? !1 : De(C, P), R = (P, E) => !(E && Da(h, E));
    if (m != null && m !== f) {
      if (Fa(t), ze(m))
        h[m] = null, A(m) && (w[m] = null);
      else if (/* @__PURE__ */ ot(m)) {
        const P = t;
        R(m, P.k) && (m.value = null), P.k && (h[P.k] = null);
      }
    }
    if (Ie(f))
      xi(f, c, 12, [r, h]);
    else {
      const P = ze(f), E = /* @__PURE__ */ ot(f);
      if (P || E) {
        const Z = () => {
          if (e.f) {
            const I = P ? A(f) ? w[f] : h[f] : R() || !e.k ? f.value : h[e.k];
            if (s)
              Ce(I) && wo(I, a);
            else if (Ce(I))
              I.includes(a) || I.push(a);
            else if (P)
              h[f] = [a], A(f) && (w[f] = h[f]);
            else {
              const V = [a];
              R(f, e.k) && (f.value = V), e.k && (h[e.k] = V);
            }
          } else P ? (h[f] = r, A(f) && (w[f] = r)) : E && (R(f, e.k) && (f.value = r), e.k && (h[e.k] = r));
        };
        if (r) {
          const I = () => {
            Z(), Xi.delete(e);
          };
          I.id = -1, Xi.set(e, I), ct(I, n);
        } else
          Fa(e), Z();
      }
    }
  }
  function Fa(e) {
    const t = Xi.get(e);
    t && (t.flags |= 8, Xi.delete(e));
  }
  us().requestIdleCallback;
  us().cancelIdleCallback;
  const fi = (e) => !!e.type.__asyncLoader, vs = (e) => e.type.__isKeepAlive;
  function Id(e, t) {
    fl(e, "a", t);
  }
  function $d(e, t) {
    fl(e, "da", t);
  }
  function fl(e, t, n = ft) {
    const i = e.__wdc || (e.__wdc = () => {
      let s = n;
      for (; s; ) {
        if (s.isDeactivated)
          return;
        s = s.parent;
      }
      return e();
    });
    if (ps(t, i, n), n) {
      let s = n.parent;
      for (; s && s.parent; )
        vs(s.parent.vnode) && Md(i, t, n, s), s = s.parent;
    }
  }
  function Md(e, t, n, i) {
    const s = ps(
      t,
      e,
      i,
      !0
      /* prepend */
    );
    Lo(() => {
      wo(i[t], s);
    }, n);
  }
  function ps(e, t, n = ft, i = !1) {
    if (n) {
      const s = n[e] || (n[e] = []), a = t.__weh || (t.__weh = (...r) => {
        Jt();
        const c = Si(n), f = Pt(t, n, e, r);
        return c(), Xt(), f;
      });
      return i ? s.unshift(a) : s.push(a), a;
    }
  }
  const en = (e) => (t, n = ft) => {
    (!_i || e === "sp") && ps(e, (...i) => t(...i), n);
  }, Td = en("bm"), Un = en("m"), Pd = en(
    "bu"
  ), Ed = en("u"), vn = en(
    "bum"
  ), Lo = en("um"), Rd = en(
    "sp"
  ), Nd = en("rtg"), Ld = en("rtc");
  function Od(e, t = ft) {
    ps("ec", e, t);
  }
  const Dd = /* @__PURE__ */ Symbol.for("v-ndc");
  function Te(e, t, n, i) {
    let s;
    const a = n, r = Ce(e);
    if (r || ze(e)) {
      const c = r && /* @__PURE__ */ An(e);
      let f = !1, m = !1;
      c && (f = !/* @__PURE__ */ xt(e), m = /* @__PURE__ */ Yt(e), e = ds(e)), s = new Array(e.length);
      for (let h = 0, w = e.length; h < w; h++)
        s[h] = t(
          f ? m ? Bn(Tt(e[h])) : Tt(e[h]) : e[h],
          h,
          void 0,
          a
        );
    } else if (typeof e == "number") {
      s = new Array(e);
      for (let c = 0; c < e; c++)
        s[c] = t(c + 1, c, void 0, a);
    } else if (qe(e))
      if (e[Symbol.iterator])
        s = Array.from(
          e,
          (c, f) => t(c, f, void 0, a)
        );
      else {
        const c = Object.keys(e);
        s = new Array(c.length);
        for (let f = 0, m = c.length; f < m; f++) {
          const h = c[f];
          s[f] = t(e[h], h, f, a);
        }
      }
    else
      s = [];
    return s;
  }
  const ro = (e) => e ? Pl(e) ? ms(e) : ro(e.parent) : null, vi = (
    // Move PURE marker to new line to workaround compiler discarding it
    // due to type annotation
    /* @__PURE__ */ Ye(/* @__PURE__ */ Object.create(null), {
      $: (e) => e,
      $el: (e) => e.vnode.el,
      $data: (e) => e.data,
      $props: (e) => e.props,
      $attrs: (e) => e.attrs,
      $slots: (e) => e.slots,
      $refs: (e) => e.refs,
      $parent: (e) => ro(e.parent),
      $root: (e) => ro(e.root),
      $host: (e) => e.ce,
      $emit: (e) => e.emit,
      $options: (e) => pl(e),
      $forceUpdate: (e) => e.f || (e.f = () => {
        Ro(e.update);
      }),
      $nextTick: (e) => e.n || (e.n = nt.bind(e.proxy)),
      $watch: (e) => _d.bind(e)
    })
  ), Hs = (e, t) => e !== Be && !e.__isScriptSetup && De(e, t), Fd = {
    get({ _: e }, t) {
      if (t === "__v_skip")
        return !0;
      const { ctx: n, setupState: i, data: s, props: a, accessCache: r, type: c, appContext: f } = e;
      if (t[0] !== "$") {
        const C = r[t];
        if (C !== void 0)
          switch (C) {
            case 1:
              return i[t];
            case 2:
              return s[t];
            case 4:
              return n[t];
            case 3:
              return a[t];
          }
        else {
          if (Hs(i, t))
            return r[t] = 1, i[t];
          if (s !== Be && De(s, t))
            return r[t] = 2, s[t];
          if (De(a, t))
            return r[t] = 3, a[t];
          if (n !== Be && De(n, t))
            return r[t] = 4, n[t];
          lo && (r[t] = 0);
        }
      }
      const m = vi[t];
      let h, w;
      if (m)
        return t === "$attrs" && st(e.attrs, "get", ""), m(e);
      if (
        // css module (injected by vue-loader)
        (h = c.__cssModules) && (h = h[t])
      )
        return h;
      if (n !== Be && De(n, t))
        return r[t] = 4, n[t];
      if (
        // global properties
        w = f.config.globalProperties, De(w, t)
      )
        return w[t];
    },
    set({ _: e }, t, n) {
      const { data: i, setupState: s, ctx: a } = e;
      return Hs(s, t) ? (s[t] = n, !0) : i !== Be && De(i, t) ? (i[t] = n, !0) : De(e.props, t) || t[0] === "$" && t.slice(1) in e ? !1 : (a[t] = n, !0);
    },
    has({
      _: { data: e, setupState: t, accessCache: n, ctx: i, appContext: s, props: a, type: r }
    }, c) {
      let f;
      return !!(n[c] || e !== Be && c[0] !== "$" && De(e, c) || Hs(t, c) || De(a, c) || De(i, c) || De(vi, c) || De(s.config.globalProperties, c) || (f = r.__cssModules) && f[c]);
    },
    defineProperty(e, t, n) {
      return n.get != null ? e._.accessCache[t] = 0 : De(n, "value") && this.set(e, t, n.value, null), Reflect.defineProperty(e, t, n);
    }
  };
  function qa(e) {
    return Ce(e) ? e.reduce(
      (t, n) => (t[n] = null, t),
      {}
    ) : e;
  }
  let lo = !0;
  function qd(e) {
    const t = pl(e), n = e.proxy, i = e.ctx;
    lo = !1, t.beforeCreate && ja(t.beforeCreate, e, "bc");
    const {
      // state
      data: s,
      computed: a,
      methods: r,
      watch: c,
      provide: f,
      inject: m,
      // lifecycle
      created: h,
      beforeMount: w,
      mounted: C,
      beforeUpdate: A,
      updated: R,
      activated: P,
      deactivated: E,
      beforeDestroy: Z,
      beforeUnmount: I,
      destroyed: V,
      unmounted: ie,
      render: he,
      renderTracked: Se,
      renderTriggered: de,
      errorCaptured: ve,
      serverPrefetch: oe,
      // public API
      expose: me,
      inheritAttrs: _e,
      // assets
      components: b,
      directives: T,
      filters: S
    } = t;
    if (m && jd(m, i, null), r)
      for (const F in r) {
        const ae = r[F];
        Ie(ae) && (i[F] = ae.bind(n));
      }
    if (s) {
      const F = s.call(n, n);
      qe(F) && (e.data = /* @__PURE__ */ To(F));
    }
    if (lo = !0, a)
      for (const F in a) {
        const ae = a[F], Y = Ie(ae) ? ae.bind(n, n) : Ie(ae.get) ? ae.get.bind(n, n) : Ht, ge = !Ie(ae) && Ie(ae.set) ? ae.set.bind(n) : Ht, xe = J({
          get: Y,
          set: ge
        });
        Object.defineProperty(i, F, {
          enumerable: !0,
          configurable: !0,
          get: () => xe.value,
          set: (z) => xe.value = z
        });
      }
    if (c)
      for (const F in c)
        vl(c[F], i, n, F);
    if (f) {
      const F = Ie(f) ? f.call(n) : f;
      Reflect.ownKeys(F).forEach((ae) => {
        md(ae, F[ae]);
      });
    }
    h && ja(h, e, "c");
    function le(F, ae) {
      Ce(ae) ? ae.forEach((Y) => F(Y.bind(n))) : ae && F(ae.bind(n));
    }
    if (le(Td, w), le(Un, C), le(Pd, A), le(Ed, R), le(Id, P), le($d, E), le(Od, ve), le(Ld, Se), le(Nd, de), le(vn, I), le(Lo, ie), le(Rd, oe), Ce(me))
      if (me.length) {
        const F = e.exposed || (e.exposed = {});
        me.forEach((ae) => {
          Object.defineProperty(F, ae, {
            get: () => n[ae],
            set: (Y) => n[ae] = Y,
            enumerable: !0
          });
        });
      } else e.exposed || (e.exposed = {});
    he && e.render === Ht && (e.render = he), _e != null && (e.inheritAttrs = _e), b && (e.components = b), T && (e.directives = T), oe && dl(e);
  }
  function jd(e, t, n = Ht) {
    Ce(e) && (e = co(e));
    for (const i in e) {
      const s = e[i];
      let a;
      qe(s) ? "default" in s ? a = Ui(
        s.from || i,
        s.default,
        !0
      ) : a = Ui(s.from || i) : a = Ui(s), /* @__PURE__ */ ot(a) ? Object.defineProperty(t, i, {
        enumerable: !0,
        configurable: !0,
        get: () => a.value,
        set: (r) => a.value = r
      }) : t[i] = a;
    }
  }
  function ja(e, t, n) {
    Pt(
      Ce(e) ? e.map((i) => i.bind(t.proxy)) : e.bind(t.proxy),
      t,
      n
    );
  }
  function vl(e, t, n, i) {
    let s = i.includes(".") ? il(n, i) : () => n[i];
    if (ze(e)) {
      const a = t[e];
      Ie(a) && vt(s, a);
    } else if (Ie(e))
      vt(s, e.bind(n));
    else if (qe(e))
      if (Ce(e))
        e.forEach((a) => vl(a, t, n, i));
      else {
        const a = Ie(e.handler) ? e.handler.bind(n) : t[e.handler];
        Ie(a) && vt(s, a, e);
      }
  }
  function pl(e) {
    const t = e.type, { mixins: n, extends: i } = t, {
      mixins: s,
      optionsCache: a,
      config: { optionMergeStrategies: r }
    } = e.appContext, c = a.get(t);
    let f;
    return c ? f = c : !s.length && !n && !i ? f = t : (f = {}, s.length && s.forEach(
      (m) => Yi(f, m, r, !0)
    ), Yi(f, t, r)), qe(t) && a.set(t, f), f;
  }
  function Yi(e, t, n, i = !1) {
    const { mixins: s, extends: a } = t;
    a && Yi(e, a, n, !0), s && s.forEach(
      (r) => Yi(e, r, n, !0)
    );
    for (const r in t)
      if (!(i && r === "expose")) {
        const c = Zd[r] || n && n[r];
        e[r] = c ? c(e[r], t[r]) : t[r];
      }
    return e;
  }
  const Zd = {
    data: Za,
    props: Ha,
    emits: Ha,
    // objects
    methods: oi,
    computed: oi,
    // lifecycle
    beforeCreate: lt,
    created: lt,
    beforeMount: lt,
    mounted: lt,
    beforeUpdate: lt,
    updated: lt,
    beforeDestroy: lt,
    beforeUnmount: lt,
    destroyed: lt,
    unmounted: lt,
    activated: lt,
    deactivated: lt,
    errorCaptured: lt,
    serverPrefetch: lt,
    // assets
    components: oi,
    directives: oi,
    // watch
    watch: Bd,
    // provide / inject
    provide: Za,
    inject: Hd
  };
  function Za(e, t) {
    return t ? e ? function() {
      return Ye(
        Ie(e) ? e.call(this, this) : e,
        Ie(t) ? t.call(this, this) : t
      );
    } : t : e;
  }
  function Hd(e, t) {
    return oi(co(e), co(t));
  }
  function co(e) {
    if (Ce(e)) {
      const t = {};
      for (let n = 0; n < e.length; n++)
        t[e[n]] = e[n];
      return t;
    }
    return e;
  }
  function lt(e, t) {
    return e ? [...new Set([].concat(e, t))] : t;
  }
  function oi(e, t) {
    return e ? Ye(/* @__PURE__ */ Object.create(null), e, t) : t;
  }
  function Ha(e, t) {
    return e ? Ce(e) && Ce(t) ? [.../* @__PURE__ */ new Set([...e, ...t])] : Ye(
      /* @__PURE__ */ Object.create(null),
      qa(e),
      qa(t ?? {})
    ) : t;
  }
  function Bd(e, t) {
    if (!e) return t;
    if (!t) return e;
    const n = Ye(/* @__PURE__ */ Object.create(null), e);
    for (const i in t)
      n[i] = lt(e[i], t[i]);
    return n;
  }
  function hl() {
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
  let Vd = 0;
  function Ud(e, t) {
    return function(i, s = null) {
      Ie(i) || (i = Ye({}, i)), s != null && !qe(s) && (s = null);
      const a = hl(), r = /* @__PURE__ */ new WeakSet(), c = [];
      let f = !1;
      const m = a.app = {
        _uid: Vd++,
        _component: i,
        _props: s,
        _container: null,
        _context: a,
        _instance: null,
        version: Sf,
        get config() {
          return a.config;
        },
        set config(h) {
        },
        use(h, ...w) {
          return r.has(h) || (h && Ie(h.install) ? (r.add(h), h.install(m, ...w)) : Ie(h) && (r.add(h), h(m, ...w))), m;
        },
        mixin(h) {
          return a.mixins.includes(h) || a.mixins.push(h), m;
        },
        component(h, w) {
          return w ? (a.components[h] = w, m) : a.components[h];
        },
        directive(h, w) {
          return w ? (a.directives[h] = w, m) : a.directives[h];
        },
        mount(h, w, C) {
          if (!f) {
            const A = m._ceVNode || Ke(i, s);
            return A.appContext = a, C === !0 ? C = "svg" : C === !1 && (C = void 0), e(A, h, C), f = !0, m._container = h, h.__vue_app__ = m, ms(A.component);
          }
        },
        onUnmount(h) {
          c.push(h);
        },
        unmount() {
          f && (Pt(
            c,
            m._instance,
            16
          ), e(null, m._container), delete m._container.__vue_app__);
        },
        provide(h, w) {
          return a.provides[h] = w, m;
        },
        runWithContext(h) {
          const w = Zn;
          Zn = m;
          try {
            return h();
          } finally {
            Zn = w;
          }
        }
      };
      return m;
    };
  }
  let Zn = null;
  const Wd = (e, t) => t === "modelValue" || t === "model-value" ? e.modelModifiers : e[`${t}Modifiers`] || e[`${$t(t)}Modifiers`] || e[`${fn(t)}Modifiers`];
  function Kd(e, t, ...n) {
    if (e.isUnmounted) return;
    const i = e.vnode.props || Be;
    let s = n;
    const a = t.startsWith("update:"), r = a && Wd(i, t.slice(7));
    r && (r.trim && (s = n.map((h) => ze(h) ? h.trim() : h)), r.number && (s = n.map(xo)));
    let c, f = i[c = Os(t)] || // also try camelCase event handler (#2249)
    i[c = Os($t(t))];
    !f && a && (f = i[c = Os(fn(t))]), f && Pt(
      f,
      e,
      6,
      s
    );
    const m = i[c + "Once"];
    if (m) {
      if (!e.emitted)
        e.emitted = {};
      else if (e.emitted[c])
        return;
      e.emitted[c] = !0, Pt(
        m,
        e,
        6,
        s
      );
    }
  }
  const zd = /* @__PURE__ */ new WeakMap();
  function gl(e, t, n = !1) {
    const i = n ? zd : t.emitsCache, s = i.get(e);
    if (s !== void 0)
      return s;
    const a = e.emits;
    let r = {}, c = !1;
    if (!Ie(e)) {
      const f = (m) => {
        const h = gl(m, t, !0);
        h && (c = !0, Ye(r, h));
      };
      !n && t.mixins.length && t.mixins.forEach(f), e.extends && f(e.extends), e.mixins && e.mixins.forEach(f);
    }
    return !a && !c ? (qe(e) && i.set(e, null), null) : (Ce(a) ? a.forEach((f) => r[f] = null) : Ye(r, a), qe(e) && i.set(e, r), r);
  }
  function hs(e, t) {
    return !e || !rs(t) ? !1 : (t = t.slice(2).replace(/Once$/, ""), De(e, t[0].toLowerCase() + t.slice(1)) || De(e, fn(t)) || De(e, t));
  }
  function Ba(e) {
    const {
      type: t,
      vnode: n,
      proxy: i,
      withProxy: s,
      propsOptions: [a],
      slots: r,
      attrs: c,
      emit: f,
      render: m,
      renderCache: h,
      props: w,
      data: C,
      setupState: A,
      ctx: R,
      inheritAttrs: P
    } = e, E = Ji(e);
    let Z, I;
    try {
      if (n.shapeFlag & 4) {
        const ie = s || i, he = ie;
        Z = qt(
          m.call(
            he,
            ie,
            h,
            w,
            A,
            C,
            R
          )
        ), I = c;
      } else {
        const ie = t;
        Z = qt(
          ie.length > 1 ? ie(
            w,
            { attrs: c, slots: r, emit: f }
          ) : ie(
            w,
            null
          )
        ), I = t.props ? c : Gd(c);
      }
    } catch (ie) {
      pi.length = 0, fs(ie, e, 1), Z = Ke(dt);
    }
    let V = Z;
    if (I && P !== !1) {
      const ie = Object.keys(I), { shapeFlag: he } = V;
      ie.length && he & 7 && (a && ie.some(ls) && (I = Qd(
        I,
        a
      )), V = dn(V, I, !1, !0));
    }
    return n.dirs && (V = dn(V, null, !1, !0), V.dirs = V.dirs ? V.dirs.concat(n.dirs) : n.dirs), n.transition && yi(V, n.transition), Z = V, Ji(E), Z;
  }
  const Gd = (e) => {
    let t;
    for (const n in e)
      (n === "class" || n === "style" || rs(n)) && ((t || (t = {}))[n] = e[n]);
    return t;
  }, Qd = (e, t) => {
    const n = {};
    for (const i in e)
      (!ls(i) || !(i.slice(9) in t)) && (n[i] = e[i]);
    return n;
  };
  function Jd(e, t, n) {
    const { props: i, children: s, component: a } = e, { props: r, children: c, patchFlag: f } = t, m = a.emitsOptions;
    if (t.dirs || t.transition)
      return !0;
    if (n && f >= 0) {
      if (f & 1024)
        return !0;
      if (f & 16)
        return i ? Va(i, r, m) : !!r;
      if (f & 8) {
        const h = t.dynamicProps;
        for (let w = 0; w < h.length; w++) {
          const C = h[w];
          if (ml(r, i, C) && !hs(m, C))
            return !0;
        }
      }
    } else
      return (s || c) && (!c || !c.$stable) ? !0 : i === r ? !1 : i ? r ? Va(i, r, m) : !0 : !!r;
    return !1;
  }
  function Va(e, t, n) {
    const i = Object.keys(t);
    if (i.length !== Object.keys(e).length)
      return !0;
    for (let s = 0; s < i.length; s++) {
      const a = i[s];
      if (ml(t, e, a) && !hs(n, a))
        return !0;
    }
    return !1;
  }
  function ml(e, t, n) {
    const i = e[n], s = t[n];
    return n === "style" && qe(i) && qe(s) ? !So(i, s) : i !== s;
  }
  function Xd({ vnode: e, parent: t, suspense: n }, i) {
    for (; t; ) {
      const s = t.subTree;
      if (s.suspense && s.suspense.activeBranch === e && (s.suspense.vnode.el = s.el = i, e = s), s === e)
        (e = t.vnode).el = i, t = t.parent;
      else
        break;
    }
    n && n.activeBranch === e && (n.vnode.el = i);
  }
  const yl = {}, bl = () => Object.create(yl), _l = (e) => Object.getPrototypeOf(e) === yl;
  function Yd(e, t, n, i = !1) {
    const s = {}, a = bl();
    e.propsDefaults = /* @__PURE__ */ Object.create(null), wl(e, t, s, a);
    for (const r in e.propsOptions[0])
      r in s || (s[r] = void 0);
    n ? e.props = i ? s : /* @__PURE__ */ od(s) : e.type.props ? e.props = s : e.props = a, e.attrs = a;
  }
  function ef(e, t, n, i) {
    const {
      props: s,
      attrs: a,
      vnode: { patchFlag: r }
    } = e, c = /* @__PURE__ */ Le(s), [f] = e.propsOptions;
    let m = !1;
    if (
      // always force full diff in dev
      // - #1942 if hmr is enabled with sfc component
      // - vite#872 non-sfc component used by sfc component
      (i || r > 0) && !(r & 16)
    ) {
      if (r & 8) {
        const h = e.vnode.dynamicProps;
        for (let w = 0; w < h.length; w++) {
          let C = h[w];
          if (hs(e.emitsOptions, C))
            continue;
          const A = t[C];
          if (f)
            if (De(a, C))
              A !== a[C] && (a[C] = A, m = !0);
            else {
              const R = $t(C);
              s[R] = uo(
                f,
                c,
                R,
                A,
                e,
                !1
              );
            }
          else
            A !== a[C] && (a[C] = A, m = !0);
        }
      }
    } else {
      wl(e, t, s, a) && (m = !0);
      let h;
      for (const w in c)
        (!t || // for camelCase
        !De(t, w) && // it's possible the original props was passed in as kebab-case
        // and converted to camelCase (#955)
        ((h = fn(w)) === w || !De(t, h))) && (f ? n && // for camelCase
        (n[w] !== void 0 || // for kebab-case
        n[h] !== void 0) && (s[w] = uo(
          f,
          c,
          w,
          void 0,
          e,
          !0
        )) : delete s[w]);
      if (a !== c)
        for (const w in a)
          (!t || !De(t, w)) && (delete a[w], m = !0);
    }
    m && Gt(e.attrs, "set", "");
  }
  function wl(e, t, n, i) {
    const [s, a] = e.propsOptions;
    let r = !1, c;
    if (t)
      for (let f in t) {
        if (li(f))
          continue;
        const m = t[f];
        let h;
        s && De(s, h = $t(f)) ? !a || !a.includes(h) ? n[h] = m : (c || (c = {}))[h] = m : hs(e.emitsOptions, f) || (!(f in i) || m !== i[f]) && (i[f] = m, r = !0);
      }
    if (a) {
      const f = /* @__PURE__ */ Le(n), m = c || Be;
      for (let h = 0; h < a.length; h++) {
        const w = a[h];
        n[w] = uo(
          s,
          f,
          w,
          m[w],
          e,
          !De(m, w)
        );
      }
    }
    return r;
  }
  function uo(e, t, n, i, s, a) {
    const r = e[n];
    if (r != null) {
      const c = De(r, "default");
      if (c && i === void 0) {
        const f = r.default;
        if (r.type !== Function && !r.skipFactory && Ie(f)) {
          const { propsDefaults: m } = s;
          if (n in m)
            i = m[n];
          else {
            const h = Si(s);
            i = m[n] = f.call(
              null,
              t
            ), h();
          }
        } else
          i = f;
        s.ce && s.ce._setProp(n, i);
      }
      r[
        0
        /* shouldCast */
      ] && (a && !c ? i = !1 : r[
        1
        /* shouldCastTrue */
      ] && (i === "" || i === fn(n)) && (i = !0));
    }
    return i;
  }
  const tf = /* @__PURE__ */ new WeakMap();
  function kl(e, t, n = !1) {
    const i = n ? tf : t.propsCache, s = i.get(e);
    if (s)
      return s;
    const a = e.props, r = {}, c = [];
    let f = !1;
    if (!Ie(e)) {
      const h = (w) => {
        f = !0;
        const [C, A] = kl(w, t, !0);
        Ye(r, C), A && c.push(...A);
      };
      !n && t.mixins.length && t.mixins.forEach(h), e.extends && h(e.extends), e.mixins && e.mixins.forEach(h);
    }
    if (!a && !f)
      return qe(e) && i.set(e, Fn), Fn;
    if (Ce(a))
      for (let h = 0; h < a.length; h++) {
        const w = $t(a[h]);
        Ua(w) && (r[w] = Be);
      }
    else if (a)
      for (const h in a) {
        const w = $t(h);
        if (Ua(w)) {
          const C = a[h], A = r[w] = Ce(C) || Ie(C) ? { type: C } : Ye({}, C), R = A.type;
          let P = !1, E = !0;
          if (Ce(R))
            for (let Z = 0; Z < R.length; ++Z) {
              const I = R[Z], V = Ie(I) && I.name;
              if (V === "Boolean") {
                P = !0;
                break;
              } else V === "String" && (E = !1);
            }
          else
            P = Ie(R) && R.name === "Boolean";
          A[
            0
            /* shouldCast */
          ] = P, A[
            1
            /* shouldCastTrue */
          ] = E, (P || De(A, "default")) && c.push(w);
        }
      }
    const m = [r, c];
    return qe(e) && i.set(e, m), m;
  }
  function Ua(e) {
    return e[0] !== "$" && !li(e);
  }
  const Oo = (e) => e === "_" || e === "_ctx" || e === "$stable", Do = (e) => Ce(e) ? e.map(qt) : [qt(e)], nf = (e, t, n) => {
    if (t._n)
      return t;
    const i = wt((...s) => Do(t(...s)), n);
    return i._c = !1, i;
  }, xl = (e, t, n) => {
    const i = e._ctx;
    for (const s in e) {
      if (Oo(s)) continue;
      const a = e[s];
      if (Ie(a))
        t[s] = nf(s, a, i);
      else if (a != null) {
        const r = Do(a);
        t[s] = () => r;
      }
    }
  }, Sl = (e, t) => {
    const n = Do(t);
    e.slots.default = () => n;
  }, Cl = (e, t, n) => {
    for (const i in t)
      (n || !Oo(i)) && (e[i] = t[i]);
  }, sf = (e, t, n) => {
    const i = e.slots = bl();
    if (e.vnode.shapeFlag & 32) {
      const s = t._;
      s ? (Cl(i, t, n), n && Er(i, "_", s, !0)) : xl(t, i);
    } else t && Sl(e, t);
  }, of = (e, t, n) => {
    const { vnode: i, slots: s } = e;
    let a = !0, r = Be;
    if (i.shapeFlag & 32) {
      const c = t._;
      c ? n && c === 1 ? a = !1 : Cl(s, t, n) : (a = !t.$stable, xl(t, s)), r = t;
    } else t && (Sl(e, t), r = { default: 1 });
    if (a)
      for (const c in s)
        !Oo(c) && r[c] == null && delete s[c];
  }, ct = uf;
  function af(e) {
    return rf(e);
  }
  function rf(e, t) {
    const n = us();
    n.__VUE__ = !0;
    const {
      insert: i,
      remove: s,
      patchProp: a,
      createElement: r,
      createText: c,
      createComment: f,
      setText: m,
      setElementText: h,
      parentNode: w,
      nextSibling: C,
      setScopeId: A = Ht,
      insertStaticContent: R
    } = e, P = (y, k, M, D = null, q = null, L = null, ee = void 0, X = null, Q = !!k.dynamicChildren) => {
      if (y === k)
        return;
      y && !xn(y, k) && (D = Ze(y), z(y, q, L, !0), y = null), k.patchFlag === -2 && (Q = !1, k.dynamicChildren = null);
      const { type: W, ref: ue, shapeFlag: re } = k;
      switch (W) {
        case gs:
          E(y, k, M, D);
          break;
        case dt:
          Z(y, k, M, D);
          break;
        case Vs:
          y == null && I(k, M, D, ee);
          break;
        case ye:
          b(
            y,
            k,
            M,
            D,
            q,
            L,
            ee,
            X,
            Q
          );
          break;
        default:
          re & 1 ? he(
            y,
            k,
            M,
            D,
            q,
            L,
            ee,
            X,
            Q
          ) : re & 6 ? T(
            y,
            k,
            M,
            D,
            q,
            L,
            ee,
            X,
            Q
          ) : (re & 64 || re & 128) && W.process(
            y,
            k,
            M,
            D,
            q,
            L,
            ee,
            X,
            Q,
            j
          );
      }
      ue != null && q ? di(ue, y && y.ref, L, k || y, !k) : ue == null && y && y.ref != null && di(y.ref, null, L, y, !0);
    }, E = (y, k, M, D) => {
      if (y == null)
        i(
          k.el = c(k.children),
          M,
          D
        );
      else {
        const q = k.el = y.el;
        k.children !== y.children && m(q, k.children);
      }
    }, Z = (y, k, M, D) => {
      y == null ? i(
        k.el = f(k.children || ""),
        M,
        D
      ) : k.el = y.el;
    }, I = (y, k, M, D) => {
      [y.el, y.anchor] = R(
        y.children,
        k,
        M,
        D,
        y.el,
        y.anchor
      );
    }, V = ({ el: y, anchor: k }, M, D) => {
      let q;
      for (; y && y !== k; )
        q = C(y), i(y, M, D), y = q;
      i(k, M, D);
    }, ie = ({ el: y, anchor: k }) => {
      let M;
      for (; y && y !== k; )
        M = C(y), s(y), y = M;
      s(k);
    }, he = (y, k, M, D, q, L, ee, X, Q) => {
      if (k.type === "svg" ? ee = "svg" : k.type === "math" && (ee = "mathml"), y == null)
        Se(
          k,
          M,
          D,
          q,
          L,
          ee,
          X,
          Q
        );
      else {
        const W = y.el && y.el._isVueCE ? y.el : null;
        try {
          W && W._beginPatch(), oe(
            y,
            k,
            q,
            L,
            ee,
            X,
            Q
          );
        } finally {
          W && W._endPatch();
        }
      }
    }, Se = (y, k, M, D, q, L, ee, X) => {
      let Q, W;
      const { props: ue, shapeFlag: re, transition: fe, dirs: pe } = y;
      if (Q = y.el = r(
        y.type,
        L,
        ue && ue.is,
        ue
      ), re & 8 ? h(Q, y.children) : re & 16 && ve(
        y.children,
        Q,
        null,
        D,
        q,
        Bs(y, L),
        ee,
        X
      ), pe && mn(y, null, D, "created"), de(Q, y, y.scopeId, ee, D), ue) {
        for (const Pe in ue)
          Pe !== "value" && !li(Pe) && a(Q, Pe, null, ue[Pe], L, D);
        "value" in ue && a(Q, "value", null, ue.value, L), (W = ue.onVnodeBeforeMount) && Nt(W, D, y);
      }
      pe && mn(y, null, D, "beforeMount");
      const $e = lf(q, fe);
      $e && fe.beforeEnter(Q), i(Q, k, M), ((W = ue && ue.onVnodeMounted) || $e || pe) && ct(() => {
        W && Nt(W, D, y), $e && fe.enter(Q), pe && mn(y, null, D, "mounted");
      }, q);
    }, de = (y, k, M, D, q) => {
      if (M && A(y, M), D)
        for (let L = 0; L < D.length; L++)
          A(y, D[L]);
      if (q) {
        let L = q.subTree;
        if (k === L || $l(L.type) && (L.ssContent === k || L.ssFallback === k)) {
          const ee = q.vnode;
          de(
            y,
            ee,
            ee.scopeId,
            ee.slotScopeIds,
            q.parent
          );
        }
      }
    }, ve = (y, k, M, D, q, L, ee, X, Q = 0) => {
      for (let W = Q; W < y.length; W++) {
        const ue = y[W] = X ? zt(y[W]) : qt(y[W]);
        P(
          null,
          ue,
          k,
          M,
          D,
          q,
          L,
          ee,
          X
        );
      }
    }, oe = (y, k, M, D, q, L, ee) => {
      const X = k.el = y.el;
      let { patchFlag: Q, dynamicChildren: W, dirs: ue } = k;
      Q |= y.patchFlag & 16;
      const re = y.props || Be, fe = k.props || Be;
      let pe;
      if (M && yn(M, !1), (pe = fe.onVnodeBeforeUpdate) && Nt(pe, M, k, y), ue && mn(k, y, M, "beforeUpdate"), M && yn(M, !0), (re.innerHTML && fe.innerHTML == null || re.textContent && fe.textContent == null) && h(X, ""), W ? me(
        y.dynamicChildren,
        W,
        X,
        M,
        D,
        Bs(k, q),
        L
      ) : ee || ae(
        y,
        k,
        X,
        null,
        M,
        D,
        Bs(k, q),
        L,
        !1
      ), Q > 0) {
        if (Q & 16)
          _e(X, re, fe, M, q);
        else if (Q & 2 && re.class !== fe.class && a(X, "class", null, fe.class, q), Q & 4 && a(X, "style", re.style, fe.style, q), Q & 8) {
          const $e = k.dynamicProps;
          for (let Pe = 0; Pe < $e.length; Pe++) {
            const Me = $e[Pe], Je = re[Me], Ge = fe[Me];
            (Ge !== Je || Me === "value") && a(X, Me, Je, Ge, q, M);
          }
        }
        Q & 1 && y.children !== k.children && h(X, k.children);
      } else !ee && W == null && _e(X, re, fe, M, q);
      ((pe = fe.onVnodeUpdated) || ue) && ct(() => {
        pe && Nt(pe, M, k, y), ue && mn(k, y, M, "updated");
      }, D);
    }, me = (y, k, M, D, q, L, ee) => {
      for (let X = 0; X < k.length; X++) {
        const Q = y[X], W = k[X], ue = (
          // oldVNode may be an errored async setup() component inside Suspense
          // which will not have a mounted element
          Q.el && // - In the case of a Fragment, we need to provide the actual parent
          // of the Fragment itself so it can move its children.
          (Q.type === ye || // - In the case of different nodes, there is going to be a replacement
          // which also requires the correct parent container
          !xn(Q, W) || // - In the case of a component, it could contain anything.
          Q.shapeFlag & 198) ? w(Q.el) : (
            // In other cases, the parent container is not actually used so we
            // just pass the block element here to avoid a DOM parentNode call.
            M
          )
        );
        P(
          Q,
          W,
          ue,
          null,
          D,
          q,
          L,
          ee,
          !0
        );
      }
    }, _e = (y, k, M, D, q) => {
      if (k !== M) {
        if (k !== Be)
          for (const L in k)
            !li(L) && !(L in M) && a(
              y,
              L,
              k[L],
              null,
              q,
              D
            );
        for (const L in M) {
          if (li(L)) continue;
          const ee = M[L], X = k[L];
          ee !== X && L !== "value" && a(y, L, X, ee, q, D);
        }
        "value" in M && a(y, "value", k.value, M.value, q);
      }
    }, b = (y, k, M, D, q, L, ee, X, Q) => {
      const W = k.el = y ? y.el : c(""), ue = k.anchor = y ? y.anchor : c("");
      let { patchFlag: re, dynamicChildren: fe, slotScopeIds: pe } = k;
      pe && (X = X ? X.concat(pe) : pe), y == null ? (i(W, M, D), i(ue, M, D), ve(
        // #10007
        // such fragment like `<></>` will be compiled into
        // a fragment which doesn't have a children.
        // In this case fallback to an empty array
        k.children || [],
        M,
        ue,
        q,
        L,
        ee,
        X,
        Q
      )) : re > 0 && re & 64 && fe && // #2715 the previous fragment could've been a BAILed one as a result
      // of renderSlot() with no valid children
      y.dynamicChildren && y.dynamicChildren.length === fe.length ? (me(
        y.dynamicChildren,
        fe,
        M,
        q,
        L,
        ee,
        X
      ), // #2080 if the stable fragment has a key, it's a <template v-for> that may
      //  get moved around. Make sure all root level vnodes inherit el.
      // #2134 or if it's a component root, it may also get moved around
      // as the component is being moved.
      (k.key != null || q && k === q.subTree) && Fo(
        y,
        k,
        !0
        /* shallow */
      )) : ae(
        y,
        k,
        M,
        ue,
        q,
        L,
        ee,
        X,
        Q
      );
    }, T = (y, k, M, D, q, L, ee, X, Q) => {
      k.slotScopeIds = X, y == null ? k.shapeFlag & 512 ? q.ctx.activate(
        k,
        M,
        D,
        ee,
        Q
      ) : S(
        k,
        M,
        D,
        q,
        L,
        ee,
        Q
      ) : K(y, k, Q);
    }, S = (y, k, M, D, q, L, ee) => {
      const X = y.component = mf(
        y,
        D,
        q
      );
      if (vs(y) && (X.ctx.renderer = j), yf(X, !1, ee), X.asyncDep) {
        if (q && q.registerDep(X, le, ee), !y.el) {
          const Q = X.subTree = Ke(dt);
          Z(null, Q, k, M), y.placeholder = Q.el;
        }
      } else
        le(
          X,
          y,
          k,
          M,
          q,
          L,
          ee
        );
    }, K = (y, k, M) => {
      const D = k.component = y.component;
      if (Jd(y, k, M))
        if (D.asyncDep && !D.asyncResolved) {
          F(D, k, M);
          return;
        } else
          D.next = k, D.update();
      else
        k.el = y.el, D.vnode = k;
    }, le = (y, k, M, D, q, L, ee) => {
      const X = () => {
        if (y.isMounted) {
          let { next: re, bu: fe, u: pe, parent: $e, vnode: Pe } = y;
          {
            const yt = Al(y);
            if (yt) {
              re && (re.el = Pe.el, F(y, re, ee)), yt.asyncDep.then(() => {
                ct(() => {
                  y.isUnmounted || W();
                }, q);
              });
              return;
            }
          }
          let Me = re, Je;
          yn(y, !1), re ? (re.el = Pe.el, F(y, re, ee)) : re = Pe, fe && Vi(fe), (Je = re.props && re.props.onVnodeBeforeUpdate) && Nt(Je, $e, re, Pe), yn(y, !0);
          const Ge = Ba(y), Xe = y.subTree;
          y.subTree = Ge, P(
            Xe,
            Ge,
            // parent may have changed if it's in a teleport
            w(Xe.el),
            // anchor may have changed if it's in a fragment
            Ze(Xe),
            y,
            q,
            L
          ), re.el = Ge.el, Me === null && Xd(y, Ge.el), pe && ct(pe, q), (Je = re.props && re.props.onVnodeUpdated) && ct(
            () => Nt(Je, $e, re, Pe),
            q
          );
        } else {
          let re;
          const { el: fe, props: pe } = k, { bm: $e, m: Pe, parent: Me, root: Je, type: Ge } = y, Xe = fi(k);
          yn(y, !1), $e && Vi($e), !Xe && (re = pe && pe.onVnodeBeforeMount) && Nt(re, Me, k), yn(y, !0);
          {
            Je.ce && Je.ce._hasShadowRoot() && Je.ce._injectChildStyle(
              Ge,
              y.parent ? y.parent.type : void 0
            );
            const yt = y.subTree = Ba(y);
            P(
              null,
              yt,
              M,
              D,
              y,
              q,
              L
            ), k.el = yt.el;
          }
          if (Pe && ct(Pe, q), !Xe && (re = pe && pe.onVnodeMounted)) {
            const yt = k;
            ct(
              () => Nt(re, Me, yt),
              q
            );
          }
          (k.shapeFlag & 256 || Me && fi(Me.vnode) && Me.vnode.shapeFlag & 256) && y.a && ct(y.a, q), y.isMounted = !0, k = M = D = null;
        }
      };
      y.scope.on();
      const Q = y.effect = new Or(X);
      y.scope.off();
      const W = y.update = Q.run.bind(Q), ue = y.job = Q.runIfDirty.bind(Q);
      ue.i = y, ue.id = y.uid, Q.scheduler = () => Ro(ue), yn(y, !0), W();
    }, F = (y, k, M) => {
      k.component = y;
      const D = y.vnode.props;
      y.vnode = k, y.next = null, ef(y, k.props, D, M), of(y, k.children, M), Jt(), Ea(y), Xt();
    }, ae = (y, k, M, D, q, L, ee, X, Q = !1) => {
      const W = y && y.children, ue = y ? y.shapeFlag : 0, re = k.children, { patchFlag: fe, shapeFlag: pe } = k;
      if (fe > 0) {
        if (fe & 128) {
          ge(
            W,
            re,
            M,
            D,
            q,
            L,
            ee,
            X,
            Q
          );
          return;
        } else if (fe & 256) {
          Y(
            W,
            re,
            M,
            D,
            q,
            L,
            ee,
            X,
            Q
          );
          return;
        }
      }
      pe & 8 ? (ue & 16 && ne(W, q, L), re !== W && h(M, re)) : ue & 16 ? pe & 16 ? ge(
        W,
        re,
        M,
        D,
        q,
        L,
        ee,
        X,
        Q
      ) : ne(W, q, L, !0) : (ue & 8 && h(M, ""), pe & 16 && ve(
        re,
        M,
        D,
        q,
        L,
        ee,
        X,
        Q
      ));
    }, Y = (y, k, M, D, q, L, ee, X, Q) => {
      y = y || Fn, k = k || Fn;
      const W = y.length, ue = k.length, re = Math.min(W, ue);
      let fe;
      for (fe = 0; fe < re; fe++) {
        const pe = k[fe] = Q ? zt(k[fe]) : qt(k[fe]);
        P(
          y[fe],
          pe,
          M,
          null,
          q,
          L,
          ee,
          X,
          Q
        );
      }
      W > ue ? ne(
        y,
        q,
        L,
        !0,
        !1,
        re
      ) : ve(
        k,
        M,
        D,
        q,
        L,
        ee,
        X,
        Q,
        re
      );
    }, ge = (y, k, M, D, q, L, ee, X, Q) => {
      let W = 0;
      const ue = k.length;
      let re = y.length - 1, fe = ue - 1;
      for (; W <= re && W <= fe; ) {
        const pe = y[W], $e = k[W] = Q ? zt(k[W]) : qt(k[W]);
        if (xn(pe, $e))
          P(
            pe,
            $e,
            M,
            null,
            q,
            L,
            ee,
            X,
            Q
          );
        else
          break;
        W++;
      }
      for (; W <= re && W <= fe; ) {
        const pe = y[re], $e = k[fe] = Q ? zt(k[fe]) : qt(k[fe]);
        if (xn(pe, $e))
          P(
            pe,
            $e,
            M,
            null,
            q,
            L,
            ee,
            X,
            Q
          );
        else
          break;
        re--, fe--;
      }
      if (W > re) {
        if (W <= fe) {
          const pe = fe + 1, $e = pe < ue ? k[pe].el : D;
          for (; W <= fe; )
            P(
              null,
              k[W] = Q ? zt(k[W]) : qt(k[W]),
              M,
              $e,
              q,
              L,
              ee,
              X,
              Q
            ), W++;
        }
      } else if (W > fe)
        for (; W <= re; )
          z(y[W], q, L, !0), W++;
      else {
        const pe = W, $e = W, Pe = /* @__PURE__ */ new Map();
        for (W = $e; W <= fe; W++) {
          const it = k[W] = Q ? zt(k[W]) : qt(k[W]);
          it.key != null && Pe.set(it.key, W);
        }
        let Me, Je = 0;
        const Ge = fe - $e + 1;
        let Xe = !1, yt = 0;
        const Vt = new Array(Ge);
        for (W = 0; W < Ge; W++) Vt[W] = 0;
        for (W = pe; W <= re; W++) {
          const it = y[W];
          if (Je >= Ge) {
            z(it, q, L, !0);
            continue;
          }
          let Ee;
          if (it.key != null)
            Ee = Pe.get(it.key);
          else
            for (Me = $e; Me <= fe; Me++)
              if (Vt[Me - $e] === 0 && xn(it, k[Me])) {
                Ee = Me;
                break;
              }
          Ee === void 0 ? z(it, q, L, !0) : (Vt[Ee - $e] = W + 1, Ee >= yt ? yt = Ee : Xe = !0, P(
            it,
            k[Ee],
            M,
            null,
            q,
            L,
            ee,
            X,
            Q
          ), Je++);
        }
        const Wn = Xe ? cf(Vt) : Fn;
        for (Me = Wn.length - 1, W = Ge - 1; W >= 0; W--) {
          const it = $e + W, Ee = k[it], Mi = k[it + 1], Ti = it + 1 < ue ? (
            // #13559, #14173 fallback to el placeholder for unresolved async component
            Mi.el || Il(Mi)
          ) : D;
          Vt[W] === 0 ? P(
            null,
            Ee,
            M,
            Ti,
            q,
            L,
            ee,
            X,
            Q
          ) : Xe && (Me < 0 || W !== Wn[Me] ? xe(Ee, M, Ti, 2) : Me--);
        }
      }
    }, xe = (y, k, M, D, q = null) => {
      const { el: L, type: ee, transition: X, children: Q, shapeFlag: W } = y;
      if (W & 6) {
        xe(y.component.subTree, k, M, D);
        return;
      }
      if (W & 128) {
        y.suspense.move(k, M, D);
        return;
      }
      if (W & 64) {
        ee.move(y, k, M, j);
        return;
      }
      if (ee === ye) {
        i(L, k, M);
        for (let re = 0; re < Q.length; re++)
          xe(Q[re], k, M, D);
        i(y.anchor, k, M);
        return;
      }
      if (ee === Vs) {
        V(y, k, M);
        return;
      }
      if (D !== 2 && W & 1 && X)
        if (D === 0)
          X.beforeEnter(L), i(L, k, M), ct(() => X.enter(L), q);
        else {
          const { leave: re, delayLeave: fe, afterLeave: pe } = X, $e = () => {
            y.ctx.isUnmounted ? s(L) : i(L, k, M);
          }, Pe = () => {
            L._isLeaving && L[Dt](
              !0
              /* cancelled */
            ), re(L, () => {
              $e(), pe && pe();
            });
          };
          fe ? fe(L, $e, Pe) : Pe();
        }
      else
        i(L, k, M);
    }, z = (y, k, M, D = !1, q = !1) => {
      const {
        type: L,
        props: ee,
        ref: X,
        children: Q,
        dynamicChildren: W,
        shapeFlag: ue,
        patchFlag: re,
        dirs: fe,
        cacheIndex: pe,
        memo: $e
      } = y;
      if (re === -2 && (q = !1), X != null && (Jt(), di(X, null, M, y, !0), Xt()), pe != null && (k.renderCache[pe] = void 0), ue & 256) {
        k.ctx.deactivate(y);
        return;
      }
      const Pe = ue & 1 && fe, Me = !fi(y);
      let Je;
      if (Me && (Je = ee && ee.onVnodeBeforeUnmount) && Nt(Je, k, y), ue & 6)
        U(y.component, M, D);
      else {
        if (ue & 128) {
          y.suspense.unmount(M, D);
          return;
        }
        Pe && mn(y, null, k, "beforeUnmount"), ue & 64 ? y.type.remove(
          y,
          k,
          M,
          j,
          D
        ) : W && // #5154
        // when v-once is used inside a block, setBlockTracking(-1) marks the
        // parent block with hasOnce: true
        // so that it doesn't take the fast path during unmount - otherwise
        // components nested in v-once are never unmounted.
        !W.hasOnce && // #1153: fast path should not be taken for non-stable (v-for) fragments
        (L !== ye || re > 0 && re & 64) ? ne(
          W,
          k,
          M,
          !1,
          !0
        ) : (L === ye && re & 384 || !q && ue & 16) && ne(Q, k, M), D && N(y);
      }
      const Ge = $e != null && pe == null;
      (Me && (Je = ee && ee.onVnodeUnmounted) || Pe || Ge) && ct(() => {
        Je && Nt(Je, k, y), Pe && mn(y, null, k, "unmounted"), Ge && (y.el = null);
      }, M);
    }, N = (y) => {
      const { type: k, el: M, anchor: D, transition: q } = y;
      if (k === ye) {
        $(M, D);
        return;
      }
      if (k === Vs) {
        ie(y);
        return;
      }
      const L = () => {
        s(M), q && !q.persisted && q.afterLeave && q.afterLeave();
      };
      if (y.shapeFlag & 1 && q && !q.persisted) {
        const { leave: ee, delayLeave: X } = q, Q = () => ee(M, L);
        X ? X(y.el, L, Q) : Q();
      } else
        L();
    }, $ = (y, k) => {
      let M;
      for (; y !== k; )
        M = C(y), s(y), y = M;
      s(k);
    }, U = (y, k, M) => {
      const { bum: D, scope: q, job: L, subTree: ee, um: X, m: Q, a: W } = y;
      Wa(Q), Wa(W), D && Vi(D), q.stop(), L && (L.flags |= 8, z(ee, y, k, M)), X && ct(X, k), ct(() => {
        y.isUnmounted = !0;
      }, k);
    }, ne = (y, k, M, D = !1, q = !1, L = 0) => {
      for (let ee = L; ee < y.length; ee++)
        z(y[ee], k, M, D, q);
    }, Ze = (y) => {
      if (y.shapeFlag & 6)
        return Ze(y.component.subTree);
      if (y.shapeFlag & 128)
        return y.suspense.next();
      const k = C(y.anchor || y.el), M = k && k[sl];
      return M ? C(M) : k;
    };
    let H = !1;
    const B = (y, k, M) => {
      let D;
      y == null ? k._vnode && (z(k._vnode, null, null, !0), D = k._vnode.component) : P(
        k._vnode || null,
        y,
        k,
        null,
        null,
        null,
        M
      ), k._vnode = y, H || (H = !0, Ea(D), Yr(), H = !1);
    }, j = {
      p: P,
      um: z,
      m: xe,
      r: N,
      mt: S,
      mc: ve,
      pc: ae,
      pbc: me,
      n: Ze,
      o: e
    };
    return {
      render: B,
      hydrate: void 0,
      createApp: Ud(B)
    };
  }
  function Bs({ type: e, props: t }, n) {
    return n === "svg" && e === "foreignObject" || n === "mathml" && e === "annotation-xml" && t && t.encoding && t.encoding.includes("html") ? void 0 : n;
  }
  function yn({ effect: e, job: t }, n) {
    n ? (e.flags |= 32, t.flags |= 4) : (e.flags &= -33, t.flags &= -5);
  }
  function lf(e, t) {
    return (!e || e && !e.pendingBranch) && t && !t.persisted;
  }
  function Fo(e, t, n = !1) {
    const i = e.children, s = t.children;
    if (Ce(i) && Ce(s))
      for (let a = 0; a < i.length; a++) {
        const r = i[a];
        let c = s[a];
        c.shapeFlag & 1 && !c.dynamicChildren && ((c.patchFlag <= 0 || c.patchFlag === 32) && (c = s[a] = zt(s[a]), c.el = r.el), !n && c.patchFlag !== -2 && Fo(r, c)), c.type === gs && (c.patchFlag === -1 && (c = s[a] = zt(c)), c.el = r.el), c.type === dt && !c.el && (c.el = r.el);
      }
  }
  function cf(e) {
    const t = e.slice(), n = [0];
    let i, s, a, r, c;
    const f = e.length;
    for (i = 0; i < f; i++) {
      const m = e[i];
      if (m !== 0) {
        if (s = n[n.length - 1], e[s] < m) {
          t[i] = s, n.push(i);
          continue;
        }
        for (a = 0, r = n.length - 1; a < r; )
          c = a + r >> 1, e[n[c]] < m ? a = c + 1 : r = c;
        m < e[n[a]] && (a > 0 && (t[i] = n[a - 1]), n[a] = i);
      }
    }
    for (a = n.length, r = n[a - 1]; a-- > 0; )
      n[a] = r, r = t[r];
    return n;
  }
  function Al(e) {
    const t = e.subTree.component;
    if (t)
      return t.asyncDep && !t.asyncResolved ? t : Al(t);
  }
  function Wa(e) {
    if (e)
      for (let t = 0; t < e.length; t++)
        e[t].flags |= 8;
  }
  function Il(e) {
    if (e.placeholder)
      return e.placeholder;
    const t = e.component;
    return t ? Il(t.subTree) : null;
  }
  const $l = (e) => e.__isSuspense;
  function uf(e, t) {
    t && t.pendingBranch ? Ce(e) ? t.effects.push(...e) : t.effects.push(e) : gd(e);
  }
  const ye = /* @__PURE__ */ Symbol.for("v-fgt"), gs = /* @__PURE__ */ Symbol.for("v-txt"), dt = /* @__PURE__ */ Symbol.for("v-cmt"), Vs = /* @__PURE__ */ Symbol.for("v-stc"), pi = [];
  let mt = null;
  function p(e = !1) {
    pi.push(mt = e ? null : []);
  }
  function df() {
    pi.pop(), mt = pi[pi.length - 1] || null;
  }
  let bi = 1;
  function es(e, t = !1) {
    bi += e, e < 0 && mt && t && (mt.hasOnce = !0);
  }
  function Ml(e) {
    return e.dynamicChildren = bi > 0 ? mt || Fn : null, df(), bi > 0 && mt && mt.push(e), e;
  }
  function g(e, t, n, i, s, a) {
    return Ml(
      o(
        e,
        t,
        n,
        i,
        s,
        a,
        !0
      )
    );
  }
  function Lt(e, t, n, i, s) {
    return Ml(
      Ke(
        e,
        t,
        n,
        i,
        s,
        !0
      )
    );
  }
  function ts(e) {
    return e ? e.__v_isVNode === !0 : !1;
  }
  function xn(e, t) {
    return e.type === t.type && e.key === t.key;
  }
  const Tl = ({ key: e }) => e ?? null, Wi = ({
    ref: e,
    ref_key: t,
    ref_for: n
  }) => (typeof e == "number" && (e = "" + e), e != null ? ze(e) || /* @__PURE__ */ ot(e) || Ie(e) ? { i: kt, r: e, k: t, f: !!n } : e : null);
  function o(e, t = null, n = null, i = 0, s = null, a = e === ye ? 0 : 1, r = !1, c = !1) {
    const f = {
      __v_isVNode: !0,
      __v_skip: !0,
      type: e,
      props: t,
      key: t && Tl(t),
      ref: t && Wi(t),
      scopeId: tl,
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
      shapeFlag: a,
      patchFlag: i,
      dynamicProps: s,
      dynamicChildren: null,
      appContext: null,
      ctx: kt
    };
    return c ? (qo(f, n), a & 128 && e.normalize(f)) : n && (f.shapeFlag |= ze(n) ? 8 : 16), bi > 0 && // avoid a block node from tracking itself
    !r && // has current parent block
    mt && // presence of a patch flag indicates this node needs patching on updates.
    // component nodes also should always be patched, because even if the
    // component doesn't need to update, it needs to persist the instance on to
    // the next vnode so that it can be properly unmounted later.
    (f.patchFlag > 0 || a & 6) && // the EVENTS flag is only for hydration and if it is the only flag, the
    // vnode should not be considered dynamic due to handler caching.
    f.patchFlag !== 32 && mt.push(f), f;
  }
  const Ke = ff;
  function ff(e, t = null, n = null, i = 0, s = null, a = !1) {
    if ((!e || e === Dd) && (e = dt), ts(e)) {
      const c = dn(
        e,
        t,
        !0
        /* mergeRef: true */
      );
      return n && qo(c, n), bi > 0 && !a && mt && (c.shapeFlag & 6 ? mt[mt.indexOf(e)] = c : mt.push(c)), c.patchFlag = -2, c;
    }
    if (kf(e) && (e = e.__vccOpts), t) {
      t = vf(t);
      let { class: c, style: f } = t;
      c && !ze(c) && (t.class = se(c)), qe(f) && (/* @__PURE__ */ Eo(f) && !Ce(f) && (f = Ye({}, f)), t.style = un(f));
    }
    const r = ze(e) ? 1 : $l(e) ? 128 : ol(e) ? 64 : qe(e) ? 4 : Ie(e) ? 2 : 0;
    return o(
      e,
      t,
      n,
      i,
      s,
      r,
      a,
      !0
    );
  }
  function vf(e) {
    return e ? /* @__PURE__ */ Eo(e) || _l(e) ? Ye({}, e) : e : null;
  }
  function dn(e, t, n = !1, i = !1) {
    const { props: s, ref: a, patchFlag: r, children: c, transition: f } = e, m = t ? pf(s || {}, t) : s, h = {
      __v_isVNode: !0,
      __v_skip: !0,
      type: e.type,
      props: m,
      key: m && Tl(m),
      ref: t && t.ref ? (
        // #2078 in the case of <component :is="vnode" ref="extra"/>
        // if the vnode itself already has a ref, cloneVNode will need to merge
        // the refs so the single vnode can be set on multiple refs
        n && a ? Ce(a) ? a.concat(Wi(t)) : [a, Wi(t)] : Wi(t)
      ) : a,
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
      patchFlag: t && e.type !== ye ? r === -1 ? 16 : r | 16 : r,
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
      ssContent: e.ssContent && dn(e.ssContent),
      ssFallback: e.ssFallback && dn(e.ssFallback),
      placeholder: e.placeholder,
      el: e.el,
      anchor: e.anchor,
      ctx: e.ctx,
      ce: e.ce
    };
    return f && i && yi(
      h,
      f.clone(h)
    ), h;
  }
  function Fe(e = " ", t = 0) {
    return Ke(gs, null, e, t);
  }
  function x(e = "", t = !1) {
    return t ? (p(), Lt(dt, null, e)) : Ke(dt, null, e);
  }
  function qt(e) {
    return e == null || typeof e == "boolean" ? Ke(dt) : Ce(e) ? Ke(
      ye,
      null,
      // #3666, avoid reference pollution when reusing vnode
      e.slice()
    ) : ts(e) ? zt(e) : Ke(gs, null, String(e));
  }
  function zt(e) {
    return e.el === null && e.patchFlag !== -1 || e.memo ? e : dn(e);
  }
  function qo(e, t) {
    let n = 0;
    const { shapeFlag: i } = e;
    if (t == null)
      t = null;
    else if (Ce(t))
      n = 16;
    else if (typeof t == "object")
      if (i & 65) {
        const s = t.default;
        s && (s._c && (s._d = !1), qo(e, s()), s._c && (s._d = !0));
        return;
      } else {
        n = 32;
        const s = t._;
        !s && !_l(t) ? t._ctx = kt : s === 3 && kt && (kt.slots._ === 1 ? t._ = 1 : (t._ = 2, e.patchFlag |= 1024));
      }
    else Ie(t) ? (t = { default: t, _ctx: kt }, n = 32) : (t = String(t), i & 64 ? (n = 16, t = [Fe(t)]) : n = 8);
    e.children = t, e.shapeFlag |= n;
  }
  function pf(...e) {
    const t = {};
    for (let n = 0; n < e.length; n++) {
      const i = e[n];
      for (const s in i)
        if (s === "class")
          t.class !== i.class && (t.class = se([t.class, i.class]));
        else if (s === "style")
          t.style = un([t.style, i.style]);
        else if (rs(s)) {
          const a = t[s], r = i[s];
          r && a !== r && !(Ce(a) && a.includes(r)) ? t[s] = a ? [].concat(a, r) : r : r == null && a == null && // mergeProps({ 'onUpdate:modelValue': undefined }) should not retain
          // the model listener.
          !ls(s) && (t[s] = r);
        } else s !== "" && (t[s] = i[s]);
    }
    return t;
  }
  function Nt(e, t, n, i = null) {
    Pt(e, t, 7, [
      n,
      i
    ]);
  }
  const hf = hl();
  let gf = 0;
  function mf(e, t, n) {
    const i = e.type, s = (t ? t.appContext : e.appContext) || hf, a = {
      uid: gf++,
      vnode: e,
      type: i,
      parent: t,
      appContext: s,
      root: null,
      // to be immediately set
      next: null,
      subTree: null,
      // will be set synchronously right after creation
      effect: null,
      update: null,
      // will be set synchronously right after creation
      job: null,
      scope: new qu(
        !0
        /* detached */
      ),
      render: null,
      proxy: null,
      exposed: null,
      exposeProxy: null,
      withProxy: null,
      provides: t ? t.provides : Object.create(s.provides),
      ids: t ? t.ids : ["", 0, 0],
      accessCache: null,
      renderCache: [],
      // local resolved assets
      components: null,
      directives: null,
      // resolved props and emits options
      propsOptions: kl(i, s),
      emitsOptions: gl(i, s),
      // emit
      emit: null,
      // to be set immediately
      emitted: null,
      // props default value
      propsDefaults: Be,
      // inheritAttrs
      inheritAttrs: i.inheritAttrs,
      // state
      ctx: Be,
      data: Be,
      props: Be,
      attrs: Be,
      slots: Be,
      refs: Be,
      setupState: Be,
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
    return a.ctx = { _: a }, a.root = t ? t.root : a, a.emit = Kd.bind(null, a), e.ce && e.ce(a), a;
  }
  let ft = null;
  const jo = () => ft || kt;
  let ns, fo;
  {
    const e = us(), t = (n, i) => {
      let s;
      return (s = e[n]) || (s = e[n] = []), s.push(i), (a) => {
        s.length > 1 ? s.forEach((r) => r(a)) : s[0](a);
      };
    };
    ns = t(
      "__VUE_INSTANCE_SETTERS__",
      (n) => ft = n
    ), fo = t(
      "__VUE_SSR_SETTERS__",
      (n) => _i = n
    );
  }
  const Si = (e) => {
    const t = ft;
    return ns(e), e.scope.on(), () => {
      e.scope.off(), ns(t);
    };
  }, Ka = () => {
    ft && ft.scope.off(), ns(null);
  };
  function Pl(e) {
    return e.vnode.shapeFlag & 4;
  }
  let _i = !1;
  function yf(e, t = !1, n = !1) {
    t && fo(t);
    const { props: i, children: s } = e.vnode, a = Pl(e);
    Yd(e, i, a, t), sf(e, s, n || t);
    const r = a ? bf(e, t) : void 0;
    return t && fo(!1), r;
  }
  function bf(e, t) {
    const n = e.type;
    e.accessCache = /* @__PURE__ */ Object.create(null), e.proxy = new Proxy(e.ctx, Fd);
    const { setup: i } = n;
    if (i) {
      Jt();
      const s = e.setupContext = i.length > 1 ? wf(e) : null, a = Si(e), r = xi(
        i,
        e,
        0,
        [
          e.props,
          s
        ]
      ), c = $r(r);
      if (Xt(), a(), (c || e.sp) && !fi(e) && dl(e), c) {
        if (r.then(Ka, Ka), t)
          return r.then((f) => {
            za(e, f);
          }).catch((f) => {
            fs(f, e, 0);
          });
        e.asyncDep = r;
      } else
        za(e, r);
    } else
      El(e);
  }
  function za(e, t, n) {
    Ie(t) ? e.type.__ssrInlineRender ? e.ssrRender = t : e.render = t : qe(t) && (e.setupState = Qr(t)), El(e);
  }
  function El(e, t, n) {
    const i = e.type;
    e.render || (e.render = i.render || Ht);
    {
      const s = Si(e);
      Jt();
      try {
        qd(e);
      } finally {
        Xt(), s();
      }
    }
  }
  const _f = {
    get(e, t) {
      return st(e, "get", ""), e[t];
    }
  };
  function wf(e) {
    const t = (n) => {
      e.exposed = n || {};
    };
    return {
      attrs: new Proxy(e.attrs, _f),
      slots: e.slots,
      emit: e.emit,
      expose: t
    };
  }
  function ms(e) {
    return e.exposed ? e.exposeProxy || (e.exposeProxy = new Proxy(Qr(ad(e.exposed)), {
      get(t, n) {
        if (n in t)
          return t[n];
        if (n in vi)
          return vi[n](e);
      },
      has(t, n) {
        return n in t || n in vi;
      }
    })) : e.proxy;
  }
  function kf(e) {
    return Ie(e) && "__vccOpts" in e;
  }
  const J = (e, t) => /* @__PURE__ */ dd(e, t, _i);
  function xf(e, t, n) {
    try {
      es(-1);
      const i = arguments.length;
      return i === 2 ? qe(t) && !Ce(t) ? ts(t) ? Ke(e, null, [t]) : Ke(e, t) : Ke(e, null, t) : (i > 3 ? n = Array.prototype.slice.call(arguments, 2) : i === 3 && ts(n) && (n = [n]), Ke(e, t, n));
    } finally {
      es(1);
    }
  }
  const Sf = "3.5.34";
  let vo;
  const Ga = typeof window < "u" && window.trustedTypes;
  if (Ga)
    try {
      vo = /* @__PURE__ */ Ga.createPolicy("vue", {
        createHTML: (e) => e
      });
    } catch {
    }
  const Rl = vo ? (e) => vo.createHTML(e) : (e) => e, Cf = "http://www.w3.org/2000/svg", Af = "http://www.w3.org/1998/Math/MathML", Kt = typeof document < "u" ? document : null, Qa = Kt && /* @__PURE__ */ Kt.createElement("template"), If = {
    insert: (e, t, n) => {
      t.insertBefore(e, n || null);
    },
    remove: (e) => {
      const t = e.parentNode;
      t && t.removeChild(e);
    },
    createElement: (e, t, n, i) => {
      const s = t === "svg" ? Kt.createElementNS(Cf, e) : t === "mathml" ? Kt.createElementNS(Af, e) : n ? Kt.createElement(e, { is: n }) : Kt.createElement(e);
      return e === "select" && i && i.multiple != null && s.setAttribute("multiple", i.multiple), s;
    },
    createText: (e) => Kt.createTextNode(e),
    createComment: (e) => Kt.createComment(e),
    setText: (e, t) => {
      e.nodeValue = t;
    },
    setElementText: (e, t) => {
      e.textContent = t;
    },
    parentNode: (e) => e.parentNode,
    nextSibling: (e) => e.nextSibling,
    querySelector: (e) => Kt.querySelector(e),
    setScopeId(e, t) {
      e.setAttribute(t, "");
    },
    // __UNSAFE__
    // Reason: innerHTML.
    // Static content here can only come from compiled templates.
    // As long as the user only uses trusted templates, this is safe.
    insertStaticContent(e, t, n, i, s, a) {
      const r = n ? n.previousSibling : t.lastChild;
      if (s && (s === a || s.nextSibling))
        for (; t.insertBefore(s.cloneNode(!0), n), !(s === a || !(s = s.nextSibling)); )
          ;
      else {
        Qa.innerHTML = Rl(
          i === "svg" ? `<svg>${e}</svg>` : i === "mathml" ? `<math>${e}</math>` : e
        );
        const c = Qa.content;
        if (i === "svg" || i === "mathml") {
          const f = c.firstChild;
          for (; f.firstChild; )
            c.appendChild(f.firstChild);
          c.removeChild(f);
        }
        t.insertBefore(c, n);
      }
      return [
        // first
        r ? r.nextSibling : t.firstChild,
        // last
        n ? n.previousSibling : t.lastChild
      ];
    }
  }, on = "transition", ni = "animation", wi = /* @__PURE__ */ Symbol("_vtc"), Nl = {
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
  }, $f = /* @__PURE__ */ Ye(
    {},
    al,
    Nl
  ), Mf = (e) => (e.displayName = "Transition", e.props = $f, e), It = /* @__PURE__ */ Mf(
    (e, { slots: t }) => xf(Ad, Tf(e), t)
  ), bn = (e, t = []) => {
    Ce(e) ? e.forEach((n) => n(...t)) : e && e(...t);
  }, Ja = (e) => e ? Ce(e) ? e.some((t) => t.length > 1) : e.length > 1 : !1;
  function Tf(e) {
    const t = {};
    for (const b in e)
      b in Nl || (t[b] = e[b]);
    if (e.css === !1)
      return t;
    const {
      name: n = "v",
      type: i,
      duration: s,
      enterFromClass: a = `${n}-enter-from`,
      enterActiveClass: r = `${n}-enter-active`,
      enterToClass: c = `${n}-enter-to`,
      appearFromClass: f = a,
      appearActiveClass: m = r,
      appearToClass: h = c,
      leaveFromClass: w = `${n}-leave-from`,
      leaveActiveClass: C = `${n}-leave-active`,
      leaveToClass: A = `${n}-leave-to`
    } = e, R = Pf(s), P = R && R[0], E = R && R[1], {
      onBeforeEnter: Z,
      onEnter: I,
      onEnterCancelled: V,
      onLeave: ie,
      onLeaveCancelled: he,
      onBeforeAppear: Se = Z,
      onAppear: de = I,
      onAppearCancelled: ve = V
    } = t, oe = (b, T, S, K) => {
      b._enterCancelled = K, _n(b, T ? h : c), _n(b, T ? m : r), S && S();
    }, me = (b, T) => {
      b._isLeaving = !1, _n(b, w), _n(b, A), _n(b, C), T && T();
    }, _e = (b) => (T, S) => {
      const K = b ? de : I, le = () => oe(T, b, S);
      bn(K, [T, le]), Xa(() => {
        _n(T, b ? f : a), Wt(T, b ? h : c), Ja(K) || Ya(T, i, P, le);
      });
    };
    return Ye(t, {
      onBeforeEnter(b) {
        bn(Z, [b]), Wt(b, a), Wt(b, r);
      },
      onBeforeAppear(b) {
        bn(Se, [b]), Wt(b, f), Wt(b, m);
      },
      onEnter: _e(!1),
      onAppear: _e(!0),
      onLeave(b, T) {
        b._isLeaving = !0;
        const S = () => me(b, T);
        Wt(b, w), b._enterCancelled ? (Wt(b, C), nr(b)) : (nr(b), Wt(b, C)), Xa(() => {
          b._isLeaving && (_n(b, w), Wt(b, A), Ja(ie) || Ya(b, i, E, S));
        }), bn(ie, [b, S]);
      },
      onEnterCancelled(b) {
        oe(b, !1, void 0, !0), bn(V, [b]);
      },
      onAppearCancelled(b) {
        oe(b, !0, void 0, !0), bn(ve, [b]);
      },
      onLeaveCancelled(b) {
        me(b), bn(he, [b]);
      }
    });
  }
  function Pf(e) {
    if (e == null)
      return null;
    if (qe(e))
      return [Us(e.enter), Us(e.leave)];
    {
      const t = Us(e);
      return [t, t];
    }
  }
  function Us(e) {
    return Pu(e);
  }
  function Wt(e, t) {
    t.split(/\s+/).forEach((n) => n && e.classList.add(n)), (e[wi] || (e[wi] = /* @__PURE__ */ new Set())).add(t);
  }
  function _n(e, t) {
    t.split(/\s+/).forEach((i) => i && e.classList.remove(i));
    const n = e[wi];
    n && (n.delete(t), n.size || (e[wi] = void 0));
  }
  function Xa(e) {
    requestAnimationFrame(() => {
      requestAnimationFrame(e);
    });
  }
  let Ef = 0;
  function Ya(e, t, n, i) {
    const s = e._endId = ++Ef, a = () => {
      s === e._endId && i();
    };
    if (n != null)
      return setTimeout(a, n);
    const { type: r, timeout: c, propCount: f } = Rf(e, t);
    if (!r)
      return i();
    const m = r + "end";
    let h = 0;
    const w = () => {
      e.removeEventListener(m, C), a();
    }, C = (A) => {
      A.target === e && ++h >= f && w();
    };
    setTimeout(() => {
      h < f && w();
    }, c + 1), e.addEventListener(m, C);
  }
  function Rf(e, t) {
    const n = window.getComputedStyle(e), i = (R) => (n[R] || "").split(", "), s = i(`${on}Delay`), a = i(`${on}Duration`), r = er(s, a), c = i(`${ni}Delay`), f = i(`${ni}Duration`), m = er(c, f);
    let h = null, w = 0, C = 0;
    t === on ? r > 0 && (h = on, w = r, C = a.length) : t === ni ? m > 0 && (h = ni, w = m, C = f.length) : (w = Math.max(r, m), h = w > 0 ? r > m ? on : ni : null, C = h ? h === on ? a.length : f.length : 0);
    const A = h === on && /\b(?:transform|all)(?:,|$)/.test(
      i(`${on}Property`).toString()
    );
    return {
      type: h,
      timeout: w,
      propCount: C,
      hasTransform: A
    };
  }
  function er(e, t) {
    for (; e.length < t.length; )
      e = e.concat(e);
    return Math.max(...t.map((n, i) => tr(n) + tr(e[i])));
  }
  function tr(e) {
    return e === "auto" ? 0 : Number(e.slice(0, -1).replace(",", ".")) * 1e3;
  }
  function nr(e) {
    return (e ? e.ownerDocument : document).body.offsetHeight;
  }
  function Nf(e, t, n) {
    const i = e[wi];
    i && (t = (t ? [t, ...i] : [...i]).join(" ")), t == null ? e.removeAttribute("class") : n ? e.setAttribute("class", t) : e.className = t;
  }
  const is = /* @__PURE__ */ Symbol("_vod"), Ll = /* @__PURE__ */ Symbol("_vsh"), an = {
    // used for prop mismatch check during hydration
    name: "show",
    beforeMount(e, { value: t }, { transition: n }) {
      e[is] = e.style.display === "none" ? "" : e.style.display, n && t ? n.beforeEnter(e) : ii(e, t);
    },
    mounted(e, { value: t }, { transition: n }) {
      n && t && n.enter(e);
    },
    updated(e, { value: t, oldValue: n }, { transition: i }) {
      !t != !n && (i ? t ? (i.beforeEnter(e), ii(e, !0), i.enter(e)) : i.leave(e, () => {
        ii(e, !1);
      }) : ii(e, t));
    },
    beforeUnmount(e, { value: t }) {
      ii(e, t);
    }
  };
  function ii(e, t) {
    e.style.display = t ? e[is] : "none", e[Ll] = !t;
  }
  const Lf = /* @__PURE__ */ Symbol(""), Of = /(?:^|;)\s*display\s*:/;
  function Df(e, t, n) {
    const i = e.style, s = ze(n);
    let a = !1;
    if (n && !s) {
      if (t)
        if (ze(t))
          for (const r of t.split(";")) {
            const c = r.slice(0, r.indexOf(":")).trim();
            n[c] == null && ai(i, c, "");
          }
        else
          for (const r in t)
            n[r] == null && ai(i, r, "");
      for (const r in n) {
        r === "display" && (a = !0);
        const c = n[r];
        c != null ? qf(
          e,
          r,
          !ze(t) && t ? t[r] : void 0,
          c
        ) || ai(i, r, c) : ai(i, r, "");
      }
    } else if (s) {
      if (t !== n) {
        const r = i[Lf];
        r && (n += ";" + r), i.cssText = n, a = Of.test(n);
      }
    } else t && e.removeAttribute("style");
    is in e && (e[is] = a ? i.display : "", e[Ll] && (i.display = "none"));
  }
  const ir = /\s*!important$/;
  function ai(e, t, n) {
    if (Ce(n))
      n.forEach((i) => ai(e, t, i));
    else if (n == null && (n = ""), t.startsWith("--"))
      e.setProperty(t, n);
    else {
      const i = Ff(e, t);
      ir.test(n) ? e.setProperty(
        fn(i),
        n.replace(ir, ""),
        "important"
      ) : e[i] = n;
    }
  }
  const sr = ["Webkit", "Moz", "ms"], Ws = {};
  function Ff(e, t) {
    const n = Ws[t];
    if (n)
      return n;
    let i = $t(t);
    if (i !== "filter" && i in e)
      return Ws[t] = i;
    i = Pr(i);
    for (let s = 0; s < sr.length; s++) {
      const a = sr[s] + i;
      if (a in e)
        return Ws[t] = a;
    }
    return t;
  }
  function qf(e, t, n, i) {
    return e.tagName === "TEXTAREA" && (t === "width" || t === "height") && ze(i) && n === i;
  }
  const or = "http://www.w3.org/1999/xlink";
  function ar(e, t, n, i, s, a = Du(t)) {
    i && t.startsWith("xlink:") ? n == null ? e.removeAttributeNS(or, t.slice(6, t.length)) : e.setAttributeNS(or, t, n) : n == null || a && !Rr(n) ? e.removeAttribute(t) : e.setAttribute(
      t,
      a ? "" : Bt(n) ? String(n) : n
    );
  }
  function rr(e, t, n, i, s) {
    if (t === "innerHTML" || t === "textContent") {
      n != null && (e[t] = t === "innerHTML" ? Rl(n) : n);
      return;
    }
    const a = e.tagName;
    if (t === "value" && a !== "PROGRESS" && // custom elements may use _value internally
    !a.includes("-")) {
      const c = a === "OPTION" ? e.getAttribute("value") || "" : e.value, f = n == null ? (
        // #11647: value should be set as empty string for null and undefined,
        // but <input type="checkbox"> should be set as 'on'.
        e.type === "checkbox" ? "on" : ""
      ) : String(n);
      (c !== f || !("_value" in e)) && (e.value = f), n == null && e.removeAttribute(t), e._value = n;
      return;
    }
    let r = !1;
    if (n === "" || n == null) {
      const c = typeof e[t];
      c === "boolean" ? n = Rr(n) : n == null && c === "string" ? (n = "", r = !0) : c === "number" && (n = 0, r = !0);
    }
    try {
      e[t] = n;
    } catch {
    }
    r && e.removeAttribute(s || t);
  }
  function Dn(e, t, n, i) {
    e.addEventListener(t, n, i);
  }
  function jf(e, t, n, i) {
    e.removeEventListener(t, n, i);
  }
  const lr = /* @__PURE__ */ Symbol("_vei");
  function Zf(e, t, n, i, s = null) {
    const a = e[lr] || (e[lr] = {}), r = a[t];
    if (i && r)
      r.value = i;
    else {
      const [c, f] = Hf(t);
      if (i) {
        const m = a[t] = Uf(
          i,
          s
        );
        Dn(e, c, m, f);
      } else r && (jf(e, c, r, f), a[t] = void 0);
    }
  }
  const cr = /(?:Once|Passive|Capture)$/;
  function Hf(e) {
    let t;
    if (cr.test(e)) {
      t = {};
      let i;
      for (; i = e.match(cr); )
        e = e.slice(0, e.length - i[0].length), t[i[0].toLowerCase()] = !0;
    }
    return [e[2] === ":" ? e.slice(3) : fn(e.slice(2)), t];
  }
  let Ks = 0;
  const Bf = /* @__PURE__ */ Promise.resolve(), Vf = () => Ks || (Bf.then(() => Ks = 0), Ks = Date.now());
  function Uf(e, t) {
    const n = (i) => {
      if (!i._vts)
        i._vts = Date.now();
      else if (i._vts <= n.attached)
        return;
      Pt(
        Wf(i, n.value),
        t,
        5,
        [i]
      );
    };
    return n.value = e, n.attached = Vf(), n;
  }
  function Wf(e, t) {
    if (Ce(t)) {
      const n = e.stopImmediatePropagation;
      return e.stopImmediatePropagation = () => {
        n.call(e), e._stopped = !0;
      }, t.map(
        (i) => (s) => !s._stopped && i && i(s)
      );
    } else
      return t;
  }
  const ur = (e) => e.charCodeAt(0) === 111 && e.charCodeAt(1) === 110 && // lowercase letter
  e.charCodeAt(2) > 96 && e.charCodeAt(2) < 123, Kf = (e, t, n, i, s, a) => {
    const r = s === "svg";
    t === "class" ? Nf(e, i, r) : t === "style" ? Df(e, n, i) : rs(t) ? ls(t) || Zf(e, t, n, i, a) : (t[0] === "." ? (t = t.slice(1), !0) : t[0] === "^" ? (t = t.slice(1), !1) : zf(e, t, i, r)) ? (rr(e, t, i), !e.tagName.includes("-") && (t === "value" || t === "checked" || t === "selected") && ar(e, t, i, r, a, t !== "value")) : /* #11081 force set props for possible async custom element */ e._isVueCE && // #12408 check if it's declared prop or it's async custom element
    (Gf(e, t) || // @ts-expect-error _def is private
    e._def.__asyncLoader && (/[A-Z]/.test(t) || !ze(i))) ? rr(e, $t(t), i, a, t) : (t === "true-value" ? e._trueValue = i : t === "false-value" && (e._falseValue = i), ar(e, t, i, r));
  };
  function zf(e, t, n, i) {
    if (i)
      return !!(t === "innerHTML" || t === "textContent" || t in e && ur(t) && Ie(n));
    if (t === "spellcheck" || t === "draggable" || t === "translate" || t === "autocorrect" || t === "sandbox" && e.tagName === "IFRAME" || t === "form" || t === "list" && e.tagName === "INPUT" || t === "type" && e.tagName === "TEXTAREA")
      return !1;
    if (t === "width" || t === "height") {
      const s = e.tagName;
      if (s === "IMG" || s === "VIDEO" || s === "CANVAS" || s === "SOURCE")
        return !1;
    }
    return ur(t) && ze(n) ? !1 : t in e;
  }
  function Gf(e, t) {
    const n = (
      // @ts-expect-error _def is private
      e._def.props
    );
    if (!n)
      return !1;
    const i = $t(t);
    return Array.isArray(n) ? n.some((s) => $t(s) === i) : Object.keys(n).some((s) => $t(s) === i);
  }
  const dr = (e) => {
    const t = e.props["onUpdate:modelValue"] || !1;
    return Ce(t) ? (n) => Vi(t, n) : t;
  };
  function Qf(e) {
    e.target.composing = !0;
  }
  function fr(e) {
    const t = e.target;
    t.composing && (t.composing = !1, t.dispatchEvent(new Event("input")));
  }
  const zs = /* @__PURE__ */ Symbol("_assign");
  function vr(e, t, n) {
    return t && (e = e.trim()), n && (e = xo(e)), e;
  }
  const Jf = {
    created(e, { modifiers: { lazy: t, trim: n, number: i } }, s) {
      e[zs] = dr(s);
      const a = i || s.props && s.props.type === "number";
      Dn(e, t ? "change" : "input", (r) => {
        r.target.composing || e[zs](vr(e.value, n, a));
      }), (n || a) && Dn(e, "change", () => {
        e.value = vr(e.value, n, a);
      }), t || (Dn(e, "compositionstart", Qf), Dn(e, "compositionend", fr), Dn(e, "change", fr));
    },
    // set value on mounted so it's after min/max for type="range"
    mounted(e, { value: t }) {
      e.value = t ?? "";
    },
    beforeUpdate(e, { value: t, oldValue: n, modifiers: { lazy: i, trim: s, number: a } }, r) {
      if (e[zs] = dr(r), e.composing) return;
      const c = (a || e.type === "number") && !/^0\d/.test(e.value) ? xo(e.value) : e.value, f = t ?? "";
      if (c === f)
        return;
      const m = e.getRootNode();
      (m instanceof Document || m instanceof ShadowRoot) && m.activeElement === e && e.type !== "range" && (i && t === n || s && e.value.trim() === f) || (e.value = f);
    }
  }, Xf = ["ctrl", "shift", "alt", "meta"], Yf = {
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
    exact: (e, t) => Xf.some((n) => e[`${n}Key`] && !t.includes(n))
  }, Re = (e, t) => {
    if (!e) return e;
    const n = e._withMods || (e._withMods = {}), i = t.join(".");
    return n[i] || (n[i] = ((s, ...a) => {
      for (let r = 0; r < t.length; r++) {
        const c = Yf[t[r]];
        if (c && c(s, t)) return;
      }
      return e(s, ...a);
    }));
  }, ev = {
    esc: "escape",
    space: " ",
    up: "arrow-up",
    left: "arrow-left",
    right: "arrow-right",
    down: "arrow-down",
    delete: "backspace"
  }, Ol = (e, t) => {
    const n = e._withKeys || (e._withKeys = {}), i = t.join(".");
    return n[i] || (n[i] = ((s) => {
      if (!("key" in s))
        return;
      const a = fn(s.key);
      if (t.some(
        (r) => r === a || ev[r] === a
      ))
        return e(s);
    }));
  }, tv = /* @__PURE__ */ Ye({ patchProp: Kf }, If);
  let pr;
  function nv() {
    return pr || (pr = af(tv));
  }
  const iv = ((...e) => {
    const t = nv().createApp(...e), { mount: n } = t;
    return t.mount = (i) => {
      const s = ov(i);
      if (!s) return;
      const a = t._component;
      !Ie(a) && !a.render && !a.template && (a.template = s.innerHTML), s.nodeType === 1 && (s.textContent = "");
      const r = n(s, !1, sv(s));
      return s instanceof Element && (s.removeAttribute("v-cloak"), s.setAttribute("data-v-app", "")), r;
    }, t;
  });
  function sv(e) {
    if (e instanceof SVGElement)
      return "svg";
    if (typeof MathMLElement == "function" && e instanceof MathMLElement)
      return "mathml";
  }
  function ov(e) {
    return ze(e) ? document.querySelector(e) : e;
  }
  (function(t, n) {
    const i = n();
    typeof zi == "object" && zi.exports && (zi.exports = i), t && (t.OpenXnetConversationModel = i);
  })(typeof globalThis < "u" ? globalThis : void 0, function() {
    const t = {
      running: ["运行中", "Running"],
      pending: ["等待中", "Pending"],
      done: ["已完成", "Completed"],
      error: ["失败", "Failed"],
      cancelled: ["已取消", "Cancelled"],
      interrupted: ["已中断", "Interrupted"],
      awaiting_approval: ["等待确认", "Awaiting approval"],
      unknown: ["状态未知", "Unknown"]
    }, n = {
      success: "done",
      completed: "done",
      complete: "done",
      succeeded: "done",
      failed: "error",
      failure: "error",
      canceled: "cancelled",
      stopped: "interrupted",
      queued: "pending",
      waiting: "pending",
      in_progress: "running",
      approval_required: "awaiting_approval",
      waiting_approval: "awaiting_approval"
    };
    function i(b, T = 280) {
      return Array.from(String(b ?? "")).slice(0, T).join("");
    }
    function s(b) {
      if (b == null || b === "") return null;
      const T = Number(b);
      return Number.isFinite(T) && T >= 0 ? T : null;
    }
    function a(b, T = {}) {
      const S = String(b?.code || b?.errorCode || "").toLowerCase(), K = String(b?.message || ""), le = Number(b?.statusCode ?? b?.status ?? b?.httpStatus), F = /(?:http[ _:]*(?:error[!: ]*status[ :]*|status[ :]*|)|status[ :=]+)([45]\d{2})\b/i.exec(`${S} ${K}`), ae = Number.isInteger(le) && le >= 400 && le <= 599 ? le : F ? Number(F[1]) : null;
      let Y;
      T.userCanceled || b?.cancelled === !0 || ["cancelled", "canceled", "request_cancelled", "abort_err"].includes(S) || b?.name === "AbortError" && !/timeout|timedout|timed_out/.test(S) ? Y = "canceled" : ae === 401 || ae === 403 || /^(?:unauthorized|forbidden|authentication_error|invalid_api_key)$/.test(S) ? Y = "auth" : /insufficient_quota|quota_exceeded|credit_balance|billing_hard_limit/.test(S) || /insufficient[_ ]quota|quota exceeded|credit balance|余额不足|额度不足/i.test(K) ? Y = "quota" : ae ? Y = "http" : /timeout|timedout|timed_out/.test(S) || b?.name === "TimeoutError" || /timed?\s*out|timeout|超时/i.test(K) ? Y = "timeout" : T.online === !1 ? Y = "offline" : T.beforeRequest ? Y = "application" : S === "stream_interrupted" || T.streamStarted ? Y = "stream" : Y = "transport";
      const ge = ["offline", "timeout", "stream", "transport"].includes(Y) || Y === "http" && [408, 429, 500, 502, 503, 504].includes(ae), xe = { canceled: "user_cancelled", auth: "authentication_required", quota: "quota_or_billing", http: "service_response", timeout: "request_timeout", offline: "device_offline", application: "request_not_started", stream: "response_stream_interrupted", transport: "transport_unavailable" };
      return { kind: Y, httpStatus: ae, retryable: ge, detail: `${ae ? `HTTP ${ae} · ` : ""}${xe[Y]}` };
    }
    function r(b, T = !0) {
      if (!b || b.state === "idle") return "";
      if (b.state === "checking") return T ? `正在检查会话状态 ${b.attempt}/${b.maxAttempts}，当前进度已保留。` : `Checking conversation status ${b.attempt}/${b.maxAttempts}. Your progress is preserved.`;
      if (b.state === "offline") return T ? "当前设备已离线，已有内容已保留。网络恢复后可检查会话状态。" : "This device is offline. Existing content is preserved; check conversation status when the network returns.";
      if (b.state === "reachable")
        return b.runtimeState === "running" ? T ? "应用服务可达，原回复仍在执行。暂未启动新的生成。" : "The application is reachable; the original reply is still running. No new generation was started." : b.runtimeState !== "idle" ? T ? "应用服务可达，原回复状态仍无法确认，请稍后再次检查。" : "The application is reachable, but the original reply state remains unverified. Check again later." : T ? "应用服务可达，原响应流无法直接续接。可继续核对并续写，已有内容已保留。" : "The application is reachable; the original response stream cannot reconnect. Continue to verify and resume from the preserved content.";
      const S = {
        offline: ["网络信号已恢复，原会话尚未恢复。请检查会话状态。", "The device network signal has returned; the conversation is still interrupted. Check its status."],
        auth: ["登录或服务授权失效，请更新授权后再继续。", "Authentication is required. Update authorization before continuing."],
        quota: ["服务额度或余额不足，请处理后再继续。", "Service quota or balance is insufficient. Resolve it before continuing."],
        timeout: ["请求超时，当前进度已保留。", "The request timed out. Your progress is preserved."],
        stream: ["响应流意外中断，当前进度已保留。", "The response stream was interrupted. Your progress is preserved."],
        application: ["请求未能启动，请先检查会话保存状态。", "The request could not start. Check conversation saving first."],
        transport: ["连接中断，当前进度已保留。", "The connection was interrupted. Your progress is preserved."],
        http: [b.httpStatus === 429 ? "服务请求频率受限，请稍后检查。" : `服务暂时无法完成请求${b.httpStatus ? `（HTTP ${b.httpStatus}）` : ""}，当前进度已保留。`, b.httpStatus === 429 ? "The service rate limit was reached. Check again later." : `The service could not complete the request${b.httpStatus ? ` (HTTP ${b.httpStatus})` : ""}. Your progress is preserved.`]
      }, K = (S[b.kind] || S.transport)[T ? 0 : 1];
      return b.state === "failed" && b.attempt >= b.maxAttempts ? `${K} ${T ? `已完成 ${b.attempt} 次状态检查，仍无法确认恢复。` : `All ${b.attempt} status checks finished without verifying recovery.`}` : K;
    }
    function c(b) {
      const T = String(b || "").toLowerCase().replace(/[ -]+/g, "_"), S = n[T] || T;
      return Object.prototype.hasOwnProperty.call(t, S) ? S : "unknown";
    }
    function f(b, T = !0) {
      return t[c(b)][T ? 0 : 1];
    }
    function m(b, T = 3e6) {
      const S = String(b || "").trim();
      return !S || S.length > T || /[\u0000-\u001f]/.test(S) ? "" : /^data:/i.test(S) ? /^data:image\/(?:png|jpe?g|gif|webp|avif);base64,[a-z0-9+/=]+$/i.test(S) ? S : "" : /^(?:https?:|blob:|file:)/i.test(S) ? S : /^[a-z][a-z0-9+.-]*:/i.test(S) && !/^[a-z]:[\\/]/i.test(S) || S.startsWith("//") ? "" : S;
    }
    function h(b, T = {}) {
      const S = b && typeof b == "object" ? b : {}, K = i(S.name || T.fallbackName || "", 160);
      return {
        id: i(S.id || "", 160),
        name: K,
        image: m(S.image),
        text: i(S.text || K || "?", 2),
        kind: i(S.kind || T.fallbackKind || "assistant", 40),
        source: i(S.source || "unknown", 160)
      };
    }
    function w(b, T = 1e5) {
      if (b == null || b === "") return "";
      let S;
      try {
        S = typeof b == "string" ? b : JSON.stringify(b, null, 2);
      } catch {
        S = "[Unserializable detail / 无法序列化的详情]";
      }
      return S.length > T ? `${i(S, T)}
… [内容已截断 / Truncated]` : S;
    }
    function C(b) {
      return Array.isArray(b) ? b.filter(function(S) {
        return S && typeof S == "object";
      }).map(function(S, K) {
        return {
          id: i(S.id || `receipt-${K}`, 180),
          source: i(S.source || "unknown", 180),
          type: i(S.type || S.kind || "unknown", 80),
          status: i(S.status || "unknown", 80),
          count: s(S.count),
          characters: s(S.characters ?? S.characterCount),
          detail: w(S.detail),
          reason: w(S.reason),
          conversationId: i(S.conversationId || S.conversation_id || "", 180),
          items: Array.isArray(S.items) ? S.items.filter(function(F) {
            return F && typeof F == "object";
          }).map(function(F) {
            return {
              memoryId: i(F.memoryId, 180),
              version: i(F.version, 100),
              title: i(F.title, 400),
              ownerAgent: i(F.ownerAgent, 180),
              taskId: i(F.taskId, 180),
              characters: s(F.characters),
              recordSha256: i(F.recordSha256, 64),
              injectedContentSha256: i(F.injectedContentSha256, 64)
            };
          }) : []
        };
      }) : [];
    }
    function A(b, T = !0) {
      if (b === null) return "";
      const S = Math.max(0, Math.floor(b / 1e3));
      return S < 60 ? `${S}${T ? "秒" : "s"}` : `${Math.floor(S / 60)}${T ? "分" : "m"} ${S % 60}${T ? "秒" : "s"}`;
    }
    function R(b) {
      if (b && typeof b == "object" && !Array.isArray(b)) return b;
      if (typeof b != "string" || b.length > 3e5 || !b.trimStart().startsWith("{")) return {};
      try {
        const T = JSON.parse(b);
        return T && typeof T == "object" && !Array.isArray(T) ? T : {};
      } catch {
        return {};
      }
    }
    function P(b) {
      return typeof b == "string" && b.trim() && b.length <= 4096 && !/[\u0000-\u001f\u007f]/.test(b) ? b.trim() : "";
    }
    function E(b) {
      const T = String(b && typeof b == "object" ? b.type || "" : b || "").toLowerCase();
      return { add: "create", added: "create", created: "create", create: "create", edit: "modify", update: "modify", modified: "modify", modify: "modify", remove: "delete", deleted: "delete", delete: "delete", move: "rename", renamed: "rename", rename: "rename", write: "write" }[T] || "";
    }
    function Z(b) {
      return typeof b == "number" && Number.isSafeInteger(b) && b >= 0 ? b : null;
    }
    function I(b) {
      const T = [
        "M12 3 20 12 12 21 4 12Z M12 7V17 M7 12H17",
        "M5 5H19V19H5Z M5 12H19 M12 5V19 M8 8H16V16H8Z",
        "M12 3 21 18H3Z M12 9 16 16H8Z",
        "M12 3V8 M12 16V21 M3 12H8 M16 12H21 M7 7 17 17 M17 7 7 17",
        "M4 8 12 3 20 8V16L12 21 4 16Z M4 8 12 13 20 8 M12 13V21",
        "M4 4H10V10H4Z M14 4H20V10H14Z M4 14H10V20H4Z M14 14H20V20H14Z",
        "M12 3C21 3 21 21 12 21S3 3 12 3Z M3 12H21 M12 3C5 9 5 15 12 21C19 15 19 9 12 3Z",
        "M3 7 7 3 12 8 17 3 21 7 16 12 21 17 17 21 12 16 7 21 3 17 8 12Z",
        "M4 5H20L12 12Z M4 19H20L12 12Z M4 5V19 M20 5V19",
        "M12 3 15 8 21 9 17 14 18 21 12 18 6 21 7 14 3 9 9 8Z",
        "M4 4 20 20 M20 4 4 20 M4 12 12 4 20 12 12 20Z",
        "M3 12 8 4H16L21 12 16 20H8Z M8 4 16 20 M16 4 8 20 M3 12H21"
      ];
      let S = 2166136261;
      for (const K of String(b || "agent")) S = Math.imul(S ^ K.codePointAt(0), 16777619) >>> 0;
      return { path: T[S % T.length], rotation: Math.floor(S / T.length) % 4 * 90, tone: S % 3 };
    }
    function V(b) {
      return (Array.isArray(b) ? b : Array.isArray(b?.messages) ? b.messages : []).slice(-200).flatMap(function(K, le) {
        if (!K || typeof K != "object" || ["system", "developer", "analysis", "reasoning"].includes(String(K.role || K.kind || "").toLowerCase())) return [];
        const F = { parent: "parent", user: "parent", child: "subagent", assistant: "subagent", subagent: "subagent", tool: "tool", runtime: "runtime" }[K.role || K.sender];
        if (!F || typeof K.content != "string") return [];
        const ae = ve(K.content, 6e4, !0);
        return ae ? [{ id: i(K.id || `transcript-${le}`, 240), role: F, content: ae, timestamp: K.timestamp ?? K.created_at ?? null, status: c(K.status), kind: i(K.kind || "", 80), toolName: i(K.tool_name || K.toolName || "", 160) }] : [];
      });
    }
    function ie(b) {
      if (typeof b != "string" || !b || b.length > 1e5) return null;
      const T = b.replace(/\r\n/g, `
`).split(`
`);
      let S = 0, K = 0, le = 0, F = null, ae = 0, Y = 0, ge = 0, xe = 0;
      for (let z = 0; z < T.length; z += 1) {
        const N = T[z];
        if (F && F.old === F.expectedOld && F.next === F.expectedNew && (F = null), N !== "\\ No newline at end of file") {
          if (N.startsWith("@@ ")) {
            if (F || S !== 1 || K !== 1) return null;
            const $ = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(?:.*)$/.exec(N);
            if (!$ || (F = { old: 0, next: 0, expectedOld: Number($[2] ?? 1), expectedNew: Number($[4] ?? 1) }, Number($[1]) < ge || Number($[3]) < xe)) return null;
            ge = Number($[1]) + F.expectedOld, xe = Number($[3]) + F.expectedNew, le += 1;
            continue;
          }
          if (F) {
            if (N.startsWith("+"))
              F.next += 1, ae += 1;
            else if (N.startsWith("-"))
              F.old += 1, Y += 1;
            else if (N.startsWith(" "))
              F.old += 1, F.next += 1;
            else return null;
            if (F.old > F.expectedOld || F.next > F.expectedNew) return null;
            continue;
          }
          if (N.startsWith("--- ")) {
            if (S += 1, S > 1 || K) return null;
          } else if (N.startsWith("+++ ")) {
            if (K += 1, K > 1 || S !== 1) return null;
          } else {
            if (N === "" && z === T.length - 1) continue;
            if (!le && /^(?:diff --git |index |new file mode |deleted file mode |old mode |new mode |similarity index |rename from |rename to )/.test(N)) continue;
            return null;
          }
        }
      }
      return F && (F.old !== F.expectedOld || F.next !== F.expectedNew) ? null : le > 0 && S === 1 && K === 1 ? { additions: ae, deletions: Y } : null;
    }
    function he(b) {
      if (b.success === !1 || b.ok === !1) return "error";
      const T = c(b.status || b.phase);
      return T !== "unknown" ? T : b.success === !0 || b.ok === !0 ? "done" : "unknown";
    }
    function Se(b) {
      if (!b || typeof b != "object") return [];
      const T = R(b.input), S = R(b.output), K = R(S.result), le = c(b.status), F = he(S), ae = F !== "unknown" ? F : he(K), Y = typeof b.output == "string" ? b.output.trim() : "", ge = ae === "error" || /^\[error\]|^error(?: calling tool|:)/i.test(Y), xe = R(b.executionEvent || b.execution_event), z = R(xe.item), N = xe.type === "file_change" ? xe : z.type === "file_change" ? z : {};
      let $ = he(N);
      $ === "unknown" && N === z && xe.type === "item.completed" && ($ = "done"), xe.type === "item.failed" && ($ = "error");
      let ne = [b.fileChanges, b.file_changes, S.fileChanges, S.file_changes, K.fileChanges, K.file_changes, N.fileChanges, N.file_changes, N.changes].find(function(ce) {
        return Array.isArray(ce) && ce.length > 0;
      });
      !ne && P(N.path) && (ne = [N]);
      let Ze = !1, H = !1;
      if (!ne) {
        const j = String(b.toolName || b.tool_name || b.name || b.title || "").toLowerCase(), ce = ["edit_file_patch_tool", "edit_file_patch_tool_local"].includes(j), y = ["edit_file_tool", "edit_file_tool_local"].includes(j);
        if (!ce && !y) return [];
        const k = P(T.path);
        if (!k) return [];
        H = ce ? /^Patched successfully \((?:Exact match|Normalized line endings match|Fuzzy match: ignored whitespace\/indentation differences)\)\.$/.test(Y) || /^\[Success\] Patched '.+'\.$/.test(Y) : /^Saved successfully(?: \(Backup created: [^\r\n]+\))?\.$/.test(Y) || /^\[Success\] Saved [^\r\n]+$/.test(Y), ne = [{ path: k, operation: ce ? "modify" : "write", before: ce ? T.old_string : void 0, after: ce ? T.new_string : T.content }], Ze = !0;
      }
      const B = [];
      for (let j = 0; j < Math.min(ne.length, 200); j += 1) {
        const ce = R(ne[j]), y = P(ce.path || ce.filePath || ce.file_path), k = E(ce.operation || ce.kind || ce.action || ce.changeType);
        if (!y || !k) continue;
        const M = he(ce);
        let D = M !== "unknown" ? M : $ !== "unknown" ? $ : ae !== "unknown" ? ae : le;
        Ze && H && !["error", "pending", "running", "awaiting_approval", "cancelled", "interrupted"].includes(D) && (D = "done"), ["error", "pending", "running", "awaiting_approval", "cancelled", "interrupted"].includes(le) && (D = le), (ge || M === "error" || $ === "error") && (D = "error");
        const q = D === "done" && ce.confirmed !== !1 && (!Ze || H);
        D === "done" && !q && (D = "unknown");
        const L = {
          id: i(ce.id || `${b.toolCallId || b.id || "tool"}:file:${j}`, 320),
          path: y,
          operation: k,
          status: D,
          confirmed: q,
          contentSource: Ze || ce.contentSource === "request" ? "request" : "receipt",
          additions: null,
          deletions: null,
          truncated: ce.truncated === !0
        }, ee = P(ce.previousPath || ce.oldPath || ce.old_path);
        ee && (L.previousPath = ee);
        const X = { diff: ce.diff ?? ce.unified_diff ?? ce.patch, before: ce.before ?? ce.oldContent ?? ce.before_content, after: ce.after ?? ce.newContent ?? ce.after_content };
        for (const [Q, W] of Object.entries(X)) {
          if (typeof W != "string") continue;
          const ue = W.slice(0, 1e5).replace(/[\uD800-\uDBFF]$/, "");
          L[Q] = ue, ue.length !== W.length && (L.truncated = !0);
        }
        if (q && L.contentSource === "receipt") {
          L.additions = Z(ce.additions ?? ce.addedLines ?? ce.lines_added), L.deletions = Z(ce.deletions ?? ce.deletedLines ?? ce.lines_deleted);
          const Q = L.truncated ? null : ie(L.diff);
          Q && (L.additions !== null && L.additions !== Q.additions || L.deletions !== null && L.deletions !== Q.deletions ? (L.additions = null, L.deletions = null) : (L.additions = L.additions ?? Q.additions, L.deletions = L.deletions ?? Q.deletions));
        }
        B.push(L);
      }
      return ne.length > 200 && B.length && (B[B.length - 1].truncated = !0), B;
    }
    function de(b, T = {}) {
      const S = b && typeof b == "object" ? b : {}, K = T.isZh !== !1, le = S.activity && typeof S.activity == "object" ? S.activity : {}, F = Array.isArray(le.steps) ? le.steps : Array.isArray(S.activityLog) ? S.activityLog : [], ae = s(T.now) ?? Date.now(), Y = !!S.generationFinished, ge = F.filter(function(B) {
        return B && typeof B == "object";
      }).map(function(B, j) {
        const ce = c(B.status), y = i(B.agentId || B.agent_id || "", 180), k = i(B.taskId || B.task_id || "", 180), M = String(B.kind || "status").toLowerCase(), D = y || ["subagent", "sub_agent", "agent"].includes(M) ? "subagent" : M, q = s(B.startedAt), L = s(B.endedAt), ee = s(B.updatedAt), X = ce === "running" && !Y, Q = X ? ae : L ?? ee, W = q !== null && Q !== null ? Math.max(0, Q - q) : null, ue = {
          id: i(B.id || `activity-${j}`, 220),
          kind: D,
          status: ce,
          label: ce === "unknown" ? f(ce, K) : i(B.label || f(ce, K), 80),
          title: i(B.title || (D === "subagent" ? K ? "子智能体" : "Subagent" : D === "tool" ? K ? "工具调用" : "Tool call" : K ? "活动" : "Activity"), 400),
          detail: w(B.detail),
          duration: String(B.duration || A(W, K)),
          running: X,
          startedAt: q,
          endedAt: L,
          updatedAt: ee
        };
        for (const pe of ["input", "output", "error", "cmd", "command", "toolName", "toolCallId"])
          B[pe] !== void 0 && B[pe] !== null && (ue[pe] = B[pe]);
        y && (ue.agentId = y), k && (ue.taskId = k);
        const re = V(B.transcript || B.agentTranscript);
        re.length && (ue.transcript = re);
        const fe = Se(B);
        return fe.length && (ue.fileChanges = fe), ue;
      }), xe = ge.some(function(B) {
        return B.running;
      }), z = !Y && (xe || !!T.active && (!ge.length || S.generationFinished === !1)), N = s(S.activityStartedAt ?? le.startedAt);
      let $ = s(S.activityEndedAt ?? le.endedAt);
      if ($ === null && !z) {
        const H = ge.map(function(j) {
          return j.endedAt ?? j.updatedAt;
        }).filter(function(j) {
          return j !== null;
        });
        H.length && ($ = Math.max(...H));
      }
      const U = z ? ae : $, ne = N !== null && U !== null ? Math.max(0, U - N) : s(le.elapsedMs), Ze = ne !== null ? A(ne, K) : String(le.elapsedLabel || "");
      return {
        visible: ge.length > 0 || z,
        active: z,
        elapsedMs: ne,
        elapsedLabel: Ze,
        steps: ge,
        signature: w({ active: z, elapsedLabel: Ze, steps: ge }, 2e6)
      };
    }
    function ve(b, T = 280, S = !1) {
      const K = String(b || ""), le = /```[^\n]*\n[\s\S]*?(?:```|$)|~~~[^\n]*\n[\s\S]*?(?:~~~|$)|`[^`\n]+`|<!--[\s\S]*?(?:-->|$)|<\/?[a-z][a-z0-9-]*(?=[\s/>])(?:[^>"']|"[^"]*"|'[^']*')*>/gi, F = [];
      let ae = 0, Y = 0, ge = "";
      for (const xe of K.matchAll(le)) {
        ae || (ge += K.slice(Y, xe.index));
        const z = xe[0];
        if (Y = xe.index + z.length, !z.startsWith("<")) {
          ae || (ge += z);
          continue;
        }
        if (z.startsWith("<!--")) continue;
        const N = /^<\/?([a-z][a-z0-9-]*)/i.exec(z)?.[1]?.toLowerCase() || "";
        if (z.startsWith("</")) {
          const H = F.map((B) => B.tag).lastIndexOf(N);
          if (H >= 0)
            for (const B of F.splice(H)) B.hidden && (ae -= 1);
          !ae && /^(?:p|li|pre|h[1-6]|blockquote|tr)$/.test(N) && (ge += " ");
          continue;
        }
        const $ = /\bclass\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(z), U = String($?.[1] || $?.[2] || $?.[3] || "").split(/\s+/), ne = /^(?:think|thought|analysis|reasoning|script|style|template)$/.test(N) || U.some((H) => /^(?:highlight-block(?:-[\w-]+)?|approval-card)$/.test(H)) || /\shidden(?:\s|=|\/?>)/i.test(z) || /\baria-hidden\s*=\s*["']?true(?:["'\s>])/i.test(z) || /\bstyle\s*=\s*["'][^"']*(?:display\s*:\s*none|visibility\s*:\s*hidden)/i.test(z), Ze = /\/\s*>$/.test(z) || /^(?:area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)$/.test(N);
        !ae && !ne && /^(?:br|hr)$/.test(N) && (ge += " "), Ze || (F.push({ tag: N, hidden: ne }), ne && (ae += 1));
      }
      return ae || (ge += K.slice(Y)), i((S ? ge : ge.replace(/\s+/g, " ")).trim(), T);
    }
    function oe(b, T = {}) {
      if (!Array.isArray(b)) return [];
      const S = T.isZh !== !1, K = /* @__PURE__ */ new Set(), le = [];
      let F = null, ae = null;
      for (const Y of b) {
        if (!Y || typeof Y != "object") continue;
        if (Y.role !== "user") {
          if (!F || Y.role !== "assistant" || Y.hidden === !0 || /^(?:analysis|reasoning|tool)$/.test(String(Y.channel || "")) || ["conversationId", "workspaceId", "projectId"].some((U) => {
            const ne = U.replace("Id", "_id"), Ze = ae[U] ?? ae[ne] ?? ae.scope?.[U], H = Y[U] ?? Y[ne] ?? Y.scope?.[U];
            return Ze != null && Ze !== "" && H != null && H !== "" && String(Ze) !== String(H);
          })) continue;
          const $ = ve(Y.text, 280);
          $ && (F.replyPreview = i([F.replyPreview, $].filter(Boolean).join(" · "), 280));
          continue;
        }
        if (F = null, ae = null, !Y.id || K.has(String(Y.id))) continue;
        const ge = String(Y.id);
        K.add(ge);
        const xe = Array.isArray(Y.attachments) ? Y.attachments.length : 0, z = ve(Y.text, 140) || (xe ? S ? `${xe} 个附件` : `${xe} attachment${xe === 1 ? "" : "s"}` : S ? "空消息" : "Empty message");
        F = { id: ge, summary: z, ordinal: le.length + 1, replyPreview: "" }, ae = Y, le.push(F);
      }
      return le;
    }
    function me(b, T) {
      for (const S of ["conversationId", "workspaceId", "projectId"]) {
        const K = S.replace("Id", "_id"), le = b[S] ?? b[K] ?? b.scope?.[S];
        if (le != null && le !== "" && String(le) !== T[S]) return !1;
      }
      return !0;
    }
    function _e(b = {}) {
      const T = {
        conversationId: i(b.conversationId, 180),
        workspaceId: i(b.workspaceId, 180),
        projectId: i(b.projectId, 180)
      }, K = (Array.isArray(b.messages) ? b.messages : []).filter(function(Y) {
        return Y && typeof Y == "object" && me(Y, T);
      }), le = Math.max(1, Math.min(80, Math.floor(s(b.maxMessages) ?? 80))), F = K.slice(-le).map(function(Y, ge) {
        const xe = de(Y), z = h(Y.identity, { fallbackKind: Y.role });
        z.image = m(z.image, 2048);
        const N = C(Y.memoryContext).filter(function(ne) {
          return !ne.conversationId || ne.conversationId === T.conversationId;
        }), $ = {
          id: i(Y.id || `${T.conversationId}:message-${Math.max(0, K.length - le) + ge}`, 220),
          role: i(Y.role || "unknown", 40),
          identity: z,
          activity: {
            visible: xe.visible,
            active: xe.active,
            steps: xe.steps.slice(-24).map(function(ne) {
              const Ze = { id: ne.id, kind: ne.kind, status: ne.status, label: f(ne.status), title: ne.kind === "subagent" ? "Subagent" : ne.kind === "tool" ? "Tool call" : "Activity", duration: i(ne.duration, 40) };
              return ne.agentId && (Ze.agentId = ne.agentId), ne.taskId && (Ze.taskId = ne.taskId), Ze;
            })
          },
          attachmentCount: Array.isArray(Y.attachments) ? Y.attachments.length : 0,
          memory: { receiptCount: N.length, statuses: [...new Set(N.map(function(ne) {
            return i(ne.status, 80);
          }))].slice(0, 16) }
        };
        return b.includeTextPreview === !0 && ($.textPreview = ve(Y.text, 280)), $;
      });
      return { schemaVersion: "1.0.0", scope: T, messages: F, truncated: K.length > F.length };
    }
    return Object.freeze({
      classifyConnectionFailure: a,
      connectionFeedbackMessage: r,
      normalizeActivityStatus: c,
      getActivityStatusLabel: f,
      normalizeIdentity: h,
      normalizeMemoryContext: C,
      projectMessageActivity: de,
      projectFileChanges: Se,
      agentGlyph: I,
      normalizeSubagentTranscript: V,
      buildConversationProjection: _e,
      buildMessageNavigation: oe,
      formatDetail: w,
      safeImageUrl: m
    });
  });
  function be() {
    return typeof window < "u" && window.openxnetApp || null;
  }
  function Ci(e) {
    if (e && typeof e.isCurrentLanguageZh == "function")
      try {
        return !!e.isCurrentLanguageZh();
      } catch {
        return !0;
      }
    return String(e?.currentLanguage || navigator.language || "zh-CN").toLowerCase().startsWith("zh");
  }
  function av(e) {
    return String(e || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function hr(e) {
    return av(e).replace(/\n/g, "<br>");
  }
  const Sn = /* @__PURE__ */ new Map(), rv = 80, Hn = /* @__PURE__ */ new Map(), lv = 24;
  function Gs() {
    for (; Sn.size > rv; ) {
      const e = Sn.keys().next().value;
      Sn.delete(e);
    }
  }
  function cv() {
    for (; Hn.size > lv; ) {
      const e = Hn.keys().next().value;
      Hn.delete(e);
    }
  }
  function uv() {
    return typeof performance < "u" && typeof performance.now == "function" ? performance.now() : Date.now();
  }
  function dv(e, t, n) {
    const i = String(t || ""), s = String(e || "streaming-message");
    if (!n || !i)
      return Hn.delete(s), i;
    const a = uv();
    let r = Hn.get(s);
    if (!r || !i.startsWith(r.raw || ""))
      return r = {
        raw: i,
        visibleLength: Math.min(i.length, 24),
        updatedAt: a
      }, Hn.set(s, r), cv(), i.slice(0, r.visibleLength);
    r.raw = i;
    const c = Math.max(0, i.length - r.visibleLength);
    if (c <= 0)
      return r.updatedAt = a, i;
    const f = Math.max(16, Math.min(180, a - r.updatedAt)), m = c > 2e3 ? 1800 : c > 600 ? 900 : 360, h = c > 600 ? 120 : 32, w = Math.max(4, Math.min(h, Math.ceil(m * f / 1e3)));
    return r.visibleLength = Math.min(i.length, r.visibleLength + w), r.updatedAt = a, i.slice(0, r.visibleLength);
  }
  function Zo(e) {
    return String(e || "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
  }
  function We(e) {
    return Array.isArray(e) ? e : [];
  }
  function fv(e, t, n, i, s = 2) {
    let a = "";
    try {
      e && typeof e.getRoleMemoryAvatarText == "function" && (a = String(e.getRoleMemoryAvatarText(t) || "").trim());
    } catch {
      a = "";
    }
    return a || (a = String(n || "").trim() || (i ? "角" : "R")), Array.from(a.replace(/\s+/g, "")).slice(0, s).join("").toUpperCase() || (i ? "角" : "R");
  }
  function vv(e, t) {
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
  function Zt(e) {
    return String(e || "").trim();
  }
  function Ve(e) {
    return Zt(e).replace(/[\\/]+$/, "").toLowerCase();
  }
  function gr(e) {
    return e ? "实时对话" : "Live Chat";
  }
  function ss(e) {
    return e ? "未选择模型" : "No model";
  }
  function po(e, t) {
    try {
      if (e && typeof e.getProviderModelOptionValue == "function")
        return String(e.getProviderModelOptionValue(t) || "").trim();
    } catch {
    }
    return t && typeof t == "object" ? String(t.id || t.value || t.model || t.name || t.label || "").trim() : String(t || "").trim();
  }
  function mr(e, t) {
    try {
      if (e && typeof e.getProviderModelOptionLabel == "function")
        return String(e.getProviderModelOptionLabel(t) || "").trim();
    } catch {
    }
    return t && typeof t == "object" ? String(t.label || t.name || t.id || t.value || t.model || "").trim() : String(t || "").trim();
  }
  function Dl(e) {
    if (!e) return null;
    try {
      if (typeof e.getPrototypeCurrentMainProvider == "function") {
        const i = e.getPrototypeCurrentMainProvider();
        if (i) return i;
      }
    } catch {
    }
    try {
      if (typeof e.findModelProviderById == "function")
        return e.findModelProviderById(e?.settings?.selectedProvider) || null;
    } catch {
    }
    const t = We(e?.modelProviders), n = String(e?.settings?.selectedProvider || "").trim();
    return t.find((i) => String(i?.id || "").trim() === n) || t[0] || null;
  }
  function pv(e, t) {
    if (!e)
      return {
        providers: [],
        currentProvider: null,
        configuredCount: 0
      };
    let n = [];
    try {
      typeof e.getPrototypeModelProviderCards == "function" ? n = e.getPrototypeModelProviderCards() || [] : n = We(e.modelProviders);
    } catch {
      n = We(e.modelProviders);
    }
    const i = String(e?.settings?.selectedProvider || "").trim(), s = Dl(e), a = n.map((c, f) => {
      const m = String(c?.id || `provider-${f}`);
      let h = String(c?.displayVendor || c?.vendor || "").trim(), w = "", C = String(c?.summaryText || "").trim(), A = "";
      try {
        typeof e.getPrototypeProviderDisplayName == "function" && (h = String(e.getPrototypeProviderDisplayName(c) || h).trim());
      } catch {
      }
      try {
        typeof e.getPrototypeProviderLogo == "function" ? w = String(e.getPrototypeProviderLogo(c) || "").trim() : typeof e.getProviderDisplayLogo == "function" && (w = String(e.getProviderDisplayLogo(c) || "").trim());
      } catch {
      }
      try {
        typeof e.getPrototypeProviderSummaryText == "function" && (C = String(e.getPrototypeProviderSummaryText(c) || C).trim());
      } catch {
      }
      try {
        typeof e.getPrototypeProviderStatusLabel == "function" && (A = String(e.getPrototypeProviderStatusLabel(c) || "").trim());
      } catch {
      }
      let R = {
        status: "",
        message: "",
        models: []
      };
      try {
        typeof e.getProviderCardValidation == "function" && (R = e.getProviderCardValidation(m) || R);
      } catch {
        R = {
          status: "",
          message: "",
          models: []
        };
      }
      const P = We(R?.models).map((V) => ({
        value: po(e, V),
        label: mr(e, V)
      })).filter((V) => V.value), E = We(c?.models).map((V) => ({
        value: po(e, V),
        label: mr(e, V)
      })).filter((V) => V.value), Z = String(c?.modelId || c?.model || "").trim(), I = c?.isTemplate ? !!(s && String(s?.id || "") === m) : i ? m === i : !!(s && String(s?.id || "") === m);
      return {
        id: m,
        name: h || (t ? "未命名服务商" : "Unnamed provider"),
        vendor: String(c?.vendor || "").trim(),
        logo: w,
        summary: C,
        modelId: Z,
        models: E,
        validationStatus: String(R?.status || "").trim(),
        validationMessage: String(R?.message || "").trim(),
        validationChecks: We(R?.checks),
        matchedModel: !!R?.matched_model,
        apiKeyConfigured: !!R?.api_key_configured,
        apiKeyOptional: !!R?.api_key_optional,
        validationModels: P,
        isValidating: !!e?.providerCardValidatingById?.[m],
        isApplying: !!e?.providerCardApplyingById?.[m],
        isActive: I,
        isTemplate: !!c?.isTemplate,
        statusLabel: A || (c?.isTemplate ? t ? "模板" : "Template" : t ? "已配置" : "Configured")
      };
    }), r = a.filter((c) => {
      if (c.isTemplate) return !1;
      const f = String(c.vendor || "").trim().length > 0 && c.name !== (t ? "未命名服务商" : "Unnamed provider") && c.name !== (t ? "供应商" : "Provider"), m = !!c.modelId || Array.isArray(c.models) && c.models.length > 0, h = !!c.apiKeyConfigured;
      return f && (m || h);
    });
    return {
      providers: r,
      currentProvider: s ? r.find((c) => String(c.id) === String(s?.id || "")) || a.find((c) => String(c.id) === String(s?.id || "")) || {
        id: String(s?.id || ""),
        name: String(s?.displayVendor || s?.vendor || (t ? "当前服务商" : "Current provider")),
        vendor: String(s?.vendor || ""),
        logo: "",
        summary: "",
        modelId: String(s?.modelId || s?.model || ""),
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
        isTemplate: !!s?.isTemplate,
        statusLabel: s?.isTemplate ? t ? "模板" : "Template" : t ? "当前服务商" : "Current"
      } : null,
      configuredCount: r.length
    };
  }
  function hv(e, t) {
    const n = e?.memorySettings || {}, i = String(n.selectedMemory || "").trim(), s = We(e?.memories).map((r, c) => {
      const f = String(r?.id || "").trim(), m = String(r?.name || "").trim() || (t ? `未命名角色 ${c + 1}` : `Untitled role ${c + 1}`), h = String(r?.description || r?.personality || r?.note || "").trim(), w = fv(e, r, m, t, 2);
      return {
        id: f,
        name: m,
        desc: h || (t ? "选择后会作为当前对话角色卡使用" : "Use this role card for the current chat"),
        tag: r?.infer ? t ? "自动学习" : "Learning" : t ? "角色档案" : "Profile",
        initial: w,
        avatarText: w,
        avatarImage: String(r?.avatar || "").trim(),
        avatarBackground: vv(e, r)
      };
    }).filter((r) => r.id), a = s.find((r) => String(r.id) === i) || null;
    return {
      cards: s,
      selectedId: a ? a.id : "",
      selectedName: a ? a.name : t ? "未启用角色卡" : "No role card",
      selectedAvatarText: a ? a.avatarText : t ? "角" : "AI",
      selectedAvatarImage: a ? a.avatarImage : "",
      selectedAvatarBackground: a ? a.avatarBackground : "linear-gradient(135deg, #5BA3C5, #7BB8D4)",
      enabled: !!n.is_memory && !!a,
      available: s.length > 0 || typeof e?.openChatRoleCardPanel == "function" || typeof e?.selectRoleMemory == "function"
    };
  }
  function gv(e, t) {
    if (!e) return gr(t);
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
    return gr(t);
  }
  function mv(e, t = "") {
    const n = String(e?.prototypeTime || e?.time || "").trim();
    if (n) return n;
    const i = e?.timestamp || e?.created_at || "";
    if (!i) return t;
    try {
      const s = new Date(i);
      return Number.isNaN(s.getTime()) ? String(i) : s.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
      return String(i);
    }
  }
  function yv(e) {
    return !e || !Array.isArray(e.messages) ? !1 : e.messages.some((t, n) => t?.role === "system" && n === 0 ? !1 : String(t?.content || "").trim().length > 0 || t?.role === "assistant" && e.isTyping || t?.role === "assistant" && Array.isArray(t?.activityLog) && t.activityLog.length > 0);
  }
  function bv(e, t, n, i = n, s = "") {
    const a = String(t || "");
    if (!a.trim()) return "";
    const r = `${String(i || n)}::${String(s || "")}`, c = Sn.get(r);
    if (c && c.raw === a)
      return c.html;
    let f = "";
    try {
      if (e && typeof e.formatMessage == "function") {
        const m = e.formatMessage.call(e, a, n);
        if (m && String(m).trim())
          return f = String(m), Sn.set(r, { raw: a, html: f }), Gs(), f;
      }
    } catch {
      return f = hr(a), Sn.set(r, { raw: a, html: f }), Gs(), f;
    }
    return f = hr(a), Sn.set(r, { raw: a, html: f }), Gs(), f;
  }
  function Fl(e) {
    const t = String(e || "");
    if (!t.includes("highlight-block")) return t;
    try {
      if (typeof document < "u") {
        const n = document.createElement("div");
        return n.innerHTML = t, n.querySelectorAll(".highlight-block, .highlight-block-error").forEach((i) => i.remove()), n.innerHTML;
      }
    } catch {
    }
    return t.replace(/<div[^>]*class="[^"]*\bhighlight-block\b[^"]*"[\s\S]*?<\/div>\s*/gi, "").replace(/<div[^>]*class="[^"]*\bhighlight-block-error\b[^"]*"[\s\S]*?<\/div>\s*/gi, "");
  }
  function _v(e) {
    const t = String(e || "").replace(/\r\n/g, `
`), n = [];
    let i = "";
    for (const s of t)
      i += s, `。！？!?；;：:
`.includes(s) && (n.push(i), i = "");
    return i && n.push(i), n;
  }
  function wv(e) {
    return Zo(e).replace(/[`*_#>[\](){}"'“”‘’]/g, "").replace(/\s+/g, "").trim().toLowerCase();
  }
  function ql(e) {
    const t = String(e || "");
    if (!t.trim()) return t;
    const n = _v(t);
    if (n.length < 4) return t;
    const i = /* @__PURE__ */ new Map(), s = [];
    let a = 0;
    for (const r of n) {
      const c = wv(r), f = c.length >= 14, m = i.get(c) || 0;
      if (f && m > 0) {
        a += 1, i.set(c, m + 1);
        continue;
      }
      c && i.set(c, m + 1), s.push(r);
    }
    return a < 2 ? t : s.join("").replace(/\n{3,}/g, `

`).trim();
  }
  function kv(e, t = !1) {
    const n = t ? Fl(e) : String(e || "");
    return ql(n);
  }
  function xv(e) {
    const t = Fl(String(e || "")).replace(/<div[^>]*class="[^"]*\bhighlight-block-reasoning\b[^"]*"[^>]*>/gi, "").replace(/<\/div>/gi, " "), n = Zo(t), i = ql(n).replace(/\s+/g, " ").trim(), s = 42, a = Array.from(i);
    return a.length > s ? `${a.slice(0, s).join("")}...` : i;
  }
  function Sv(e, t, n, i) {
    return globalThis.OpenXnetConversationModel.projectMessageActivity(t, {
      isZh: i,
      active: !!e?.isTyping && n && !t?.generationFinished
    });
  }
  function Cv(e, t) {
    return globalThis.OpenXnetConversationModel.normalizeIdentity(e?.identity, {
      fallbackName: String(e?.agentName || (t === "user" ? "User" : "Assistant")),
      fallbackKind: t
    });
  }
  function Av(e) {
    return [
      ...We(e?.fileLinks).map((t) => ({ ...t, kind: "file" })),
      ...We(e?.imageLinks).map((t) => ({ ...t, kind: "image" }))
    ].map((t, n) => ({
      id: String(t.artifact_id || t.id || `attachment-${n}`),
      name: String(t.name || t.originalName || "Attachment"),
      kind: t.kind,
      path: globalThis.OpenXnetConversationModel.normalizeIdentity({ image: String(t.path || "") }).image
    }));
  }
  function jl(e) {
    const t = String(e || ""), n = /```[^\n]*\n[\s\S]*?(?:```|$)|~~~[^\n]*\n[\s\S]*?(?:~~~|$)|`[^`\n]+`|<!--[\s\S]*?(?:-->|$)|<\/?[a-z][a-z0-9-]*(?=[\s/>])(?:[^>"']|"[^"]*"|'[^']*')*>/gi, i = [];
    let s = 0, a = 0, r = "";
    for (const f of t.matchAll(n)) {
      s || (r += t.slice(a, f.index));
      const m = f[0];
      if (a = f.index + m.length, !m.startsWith("<")) {
        s || (r += m);
        continue;
      }
      if (m.startsWith("<!--")) continue;
      const h = /^<\/?([a-z][a-z0-9-]*)/i.exec(m)?.[1]?.toLowerCase() || "";
      if (m.startsWith("</")) {
        const P = i.map((E) => E.tag).lastIndexOf(h);
        if (P >= 0)
          for (const E of i.splice(P)) E.hidden && (s -= 1);
        !s && /^(?:p|div|li|pre|h[1-6]|blockquote|tr)$/.test(h) && (r += `
`);
        continue;
      }
      const w = /\bclass\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(m), C = String(w?.[1] || w?.[2] || w?.[3] || "").split(/\s+/), A = /^(?:think|thought|analysis|reasoning|script|style|template)$/.test(h) || C.some((P) => /^(?:highlight-block(?:-[\w-]+)?|approval-card)$/.test(P)) || /\shidden(?:\s|=|\/?>)/i.test(m) || /\baria-hidden\s*=\s*["']?true(?:["'\s>])/i.test(m) || /\bstyle\s*=\s*["'][^"']*(?:display\s*:\s*none|visibility\s*:\s*hidden)/i.test(m), R = /\/\s*>$/.test(m) || /^(?:area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)$/.test(h);
      !s && !A && /^(?:br|hr)$/.test(h) && (r += `
`), R || (i.push({ tag: h, hidden: A }), A && (s += 1));
    }
    s || (r += t.slice(a));
    const c = (f, m) => {
      const h = m.toLowerCase(), w = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
      if (Object.prototype.hasOwnProperty.call(w, h)) return w[h];
      const C = h.startsWith("#x") ? parseInt(h.slice(2), 16) : parseInt(h.slice(1), 10);
      return Number.isInteger(C) && C > 0 && C <= 1114111 && !(C >= 55296 && C <= 57343) ? String.fromCodePoint(C) : f;
    };
    return r.replace(/&(amp|lt|gt|quot|apos|nbsp|#\d+|#x[0-9a-f]+);/gi, c).replace(/[ \t]+\n/g, `
`).replace(/\n{3,}/g, `

`).trim();
  }
  function Ho(e) {
    const t = (e?.messages || []).map((i, s) => ({ message: i, sourceIndex: s })).filter(({ message: i }) => i?.role !== "system"), n = Ci(e);
    return t.map(({ message: i, sourceIndex: s }, a) => {
      const r = i?.role === "assistant" ? "assistant" : "user", c = a === t.length - 1, f = Sv(e, i, c, n), m = String(i?.pure_content || i?.content || ""), h = i?.id || `live-${a}`, w = r === "assistant" && c && !!e?.isTyping && !i?.generationFinished, C = r === "assistant" ? dv(h, m, w) : m, A = r === "assistant" ? kv(C, f.visible) : m, R = [
        n ? "zh" : "en",
        c && e?.isTyping ? "typing" : "idle",
        i?.generationFinished ? "done" : "open",
        f.visible ? "activity" : "plain"
      ].join(":");
      return {
        id: String(i?.id || `live-${a}`),
        role: r,
        sourceIndex: s,
        conversationId: String(i?.conversationId || e?.conversationId || ""),
        identity: Cv(i, r),
        attachments: Av(i),
        memoryContext: globalThis.OpenXnetConversationModel.normalizeMemoryContext(We(i?.memoryContext).filter((P) => String(P?.conversationId || "") === String(i?.conversationId || e?.conversationId || ""))),
        text: r === "user" ? Zo(m) : jl(m),
        html: r === "assistant" ? bv(e, A, s, h, R) : "",
        typing: r === "assistant" && !String(m || "").trim() && !!e?.isTyping && c,
        time: mv(i),
        activity: f
      };
    });
  }
  function Iv(e) {
    return e ? "从输入框开始你的第一条消息，AI 助手会立刻回应。" : "Send your first message to start chatting with the assistant.";
  }
  function $v(e, t) {
    if (!e)
      return {
        model: ss(t),
        providerName: t ? "未选择服务商" : "No provider",
        temperature: 0.7,
        maxTokens: 8192,
        maxTokensOptions: [1024, 2048, 4096, 8192, 16384, 32768],
        systemPrompt: "",
        memoryEnabled: !1,
        memoryAvailable: !1,
        nativeMemoryEnabled: !0,
        nativeMemoryAvailable: !1,
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
    const n = e.settings || {}, i = e.memorySettings || {}, s = e.codeSettings || {}, a = e.asrSettings || {}, r = e.webSearchSettings || {}, c = e.chromeMCPSettings || {}, f = e.ttsSettings || {}, m = e.visionSettings || {}, h = Array.isArray(e.MoreButtonDict) ? e.MoreButtonDict : [], w = (Z) => !!h.find((V) => V && V.name === Z)?.enabled, C = Number(n.temperature), A = Number(n.max_tokens), R = pv(e, t), P = R.currentProvider, E = hv(e, t);
    return {
      model: String(n.model || "").trim() || ss(t),
      providerName: String(P?.name || (t ? "未选择服务商" : "No provider")).trim(),
      providerLogo: String(P?.logo || "").trim(),
      providerSummary: String(P?.summary || "").trim(),
      providerId: String(P?.id || n.selectedProvider || "").trim(),
      providerCards: R.providers,
      configuredProviderCount: Number(R.configuredCount || 0),
      temperature: Number.isFinite(C) ? C : 0.7,
      maxTokens: Number.isFinite(A) && A > 0 ? A : 8192,
      maxTokensOptions: [1024, 2048, 4096, 8192, 16384, 32768],
      systemPrompt: String(e.system_prompt || "").trim(),
      memoryEnabled: !!i.is_memory,
      memoryAvailable: typeof i.is_memory == "boolean",
      nativeMemoryEnabled: i.synapxnetV3Enabled !== !1,
      nativeMemoryAvailable: typeof e.autoSaveSettings == "function",
      interpreterEnabled: !!s.enabled,
      asrEnabled: !!a.enabled,
      webSearchEnabled: !!r.enabled,
      browserControlEnabled: !!c.enabled,
      browserControlAvailable: !!e.isElectron,
      ttsEnabled: !!f.enabled,
      ttsAvailable: w("ttsButton"),
      desktopVisionEnabled: !!m.desktopVision,
      desktopVisionAvailable: !!e.isElectron && w("desktopVisionButton"),
      screenshotAvailable: !!e.isElectron && w("screenshotButton"),
      tablePetAvailable: w("vrmButton"),
      roleCardAvailable: w("roleCardButton") || E.available,
      roleCardEnabled: E.enabled,
      roleCardName: E.selectedName,
      roleCardSelectedId: E.selectedId,
      roleCardAvatarText: E.selectedAvatarText,
      roleCardAvatarImage: E.selectedAvatarImage,
      roleCardAvatarBackground: E.selectedAvatarBackground,
      roleCards: E.cards,
      isElectron: !!e.isElectron,
      completionNotificationsEnabled: e.systemSettings?.completionNotificationsEnabled !== !1,
      completionNotificationSound: e.systemSettings?.completionNotificationSound === !0,
      completionPreferencesAvailable: typeof window.electronAPI?.saveSystemSettings == "function" && typeof window.openxnetDesktop?.publishCompletionNotice == "function",
      // —— 新增：权限模式 + 上下文进度 + custom 服务商每日积分 ——
      workspace: Mv(e, t),
      permission: Tv(e, t),
      contextWindow: Nv(e, t),
      customCredits: Lv(e, P, t)
    };
  }
  function Mv(e, t) {
    const n = e?.CLISettings || {}, i = Zt(n.cc_path), s = i ? i.split(/[/\\]/).filter(Boolean).slice(-1)[0] || i : "", a = Array.isArray(e?.chatRecentProjects) ? e.chatRecentProjects : [], r = /* @__PURE__ */ new Set(), c = a.map((h) => {
      const w = Zt(h?.path || h), C = Ve(w);
      if (!w || r.has(C)) return null;
      r.add(C);
      const A = w.split(/[/\\]/).filter(Boolean).slice(-1)[0] || w;
      return {
        id: w,
        path: w,
        name: A,
        isActive: Ve(w) === Ve(i),
        lastUsed: h?.lastUsed || ""
      };
    }).filter(Boolean);
    i && !c.some((h) => Ve(h.path) === Ve(i)) && c.unshift({ id: i, path: i, name: s, isActive: !0, lastUsed: "" });
    const f = e?.gitInfo || e?.workspaceGitInfo || null, m = !!(f && f.enabled !== !1 && (f.branch || f.currentBranch));
    return {
      loaded: !!i,
      path: i,
      name: s || (t ? "未选择工作区" : "No workspace"),
      projects: c,
      git: m ? {
        enabled: !0,
        canSwitch: typeof e?.switchGitBranch == "function",
        branch: String(f.branch || f.currentBranch || "main"),
        branches: Array.isArray(f.branches) ? f.branches : [],
        dirty: !!f.dirty,
        ahead: Number(f.ahead || 0),
        behind: Number(f.behind || 0)
      } : { enabled: !1 }
    };
  }
  const Ki = /* @__PURE__ */ new WeakMap(), os = /* @__PURE__ */ new WeakMap();
  function Ai(e) {
    const t = String(e?.CLISettings?.engine || "local").trim().toLowerCase();
    return { id: t, key: { ds: "dsSettings", cc: "ccSettings", oc: "ocSettings", qc: "qcSettings", local: "localEnvSettings" }[t] || "localEnvSettings" };
  }
  function ho(e) {
    return JSON.stringify([Ai(e).id, Ve(e?.CLISettings?.cc_path)]);
  }
  function Qs(e, t, n) {
    let i = os.get(e);
    i || (i = /* @__PURE__ */ new Set(), os.set(e, i)), n ? i.add(t) : i.delete(t);
  }
  function Zl(e, t) {
    const n = Ev(e);
    if (n.length) return n;
    const i = Ai(e).id;
    return [
      { value: "default", label: t ? "默认只读模式" : "Default read-only mode" },
      { value: "plan", label: t ? "计划模式" : "Plan" },
      { value: ["cc", "oc"].includes(i) ? "acceptEdits" : i === "qc" ? "auto-edit" : "auto-approve", label: t ? "接受编辑模式" : "Accept edit mode" },
      { value: ["cc", "oc"].includes(i) ? "bypassPermissions" : "yolo", label: t ? "最高权限模式" : "All permissions mode" },
      { value: "cowork", label: t ? "Cowork 模式" : "Cowork mode" }
    ];
  }
  function Tv(e, t) {
    const n = e ? Ki.get(e) : null, i = Ai(e).id, s = ho(e), a = n?.scope === s ? n.previousMode : Hl(e), r = !!e && !!os.get(e)?.has(s), c = !!e && typeof e.autoSaveSettings == "function", f = Zl(e, t).sort(Pv).map((w) => yr(w, t, i));
    a && !f.some((w) => w.id === a) && f.unshift({ ...yr({ value: a, label: Rv(e, a, t) }, t, i), disabled: !0 });
    const m = { local: t ? "本地环境" : "Local", ds: t ? "Docker 沙箱" : "Docker Sandbox", cc: "Claude Code", oc: "Codex", qc: "Qwen Code" }[i] || i;
    let h = c ? t ? `适用于${m}的受控工具；${e.CLISettings?.enabled ? "代码智能已开启。" : "保存不会自动开启代码智能。"}` : `Applies to governed tools in ${m}; ${e.CLISettings?.enabled ? "code intelligence is enabled." : "saving does not enable code intelligence."}` : t ? "当前仅显示已保存模式，权限设置暂不可保存。" : "Showing the saved mode; permission settings cannot currently be saved.";
    return r && (h += t ? " 上次保存结果尚未确认，请重新选择当前模式保存。" : " The last save is unconfirmed. Select the current mode again to save it."), { current: a, options: f, available: c, pending: !!n, engine: i, scopeHint: h, uncertain: r };
  }
  function Pv(e, t) {
    const n = {
      default: 0,
      plan: 1,
      "auto-approve": 2,
      acceptEdits: 2,
      "auto-edit": 2,
      yolo: 3,
      bypassPermissions: 3,
      cowork: 4
    }, i = String(e?.value || e?.id || "").trim(), s = String(t?.value || t?.id || "").trim(), a = Object.prototype.hasOwnProperty.call(n, i) ? n[i] : 99, r = Object.prototype.hasOwnProperty.call(n, s) ? n[s] : 99;
    return a - r;
  }
  function Ev(e) {
    if (!e || typeof e.getCliPermissionModeOptions != "function") return [];
    try {
      return We(e.getCliPermissionModeOptions()).map((t) => ({
        value: String(t?.value || t?.id || "").trim(),
        label: String(t?.label || t?.name || t?.value || t?.id || "").trim()
      })).filter((t) => t.value);
    } catch {
      return [];
    }
  }
  function Rv(e, t, n) {
    try {
      if (e && typeof e.getPermissionModeLabel == "function") {
        const a = e.getPermissionModeLabel(t);
        if (a) return String(a);
      }
    } catch {
    }
    const i = String(t || "default").trim(), s = {
      plan: n ? "计划模式" : "Plan mode",
      default: n ? "默认只读模式" : "Default read-only mode",
      "auto-approve": n ? "接受编辑模式" : "Accept edit mode",
      acceptEdits: n ? "接受编辑模式" : "Accept edit mode",
      "auto-edit": n ? "接受编辑模式" : "Accept edit mode",
      yolo: n ? "最高权限模式" : "All permissions mode",
      bypassPermissions: n ? "最高权限模式" : "All permissions mode",
      cowork: n ? "Cowork模式" : "Cowork mode"
    };
    return s[i] || i || s.default;
  }
  function Hl(e) {
    try {
      if (e && typeof e.getActiveCliPermissionMode == "function")
        return String(e.getActiveCliPermissionMode() || "default").trim() || "default";
    } catch {
    }
    return String(e?.[Ai(e).key]?.permissionMode || e?.CLISettings?.permissionMode || "default").trim() || "default";
  }
  function yr(e, t, n = "local") {
    const i = String(e?.value || e?.id || "default").trim() || "default", s = i === "acceptEdits" || i === "auto-approve" || i === "auto-edit" ? "accept" : i === "bypassPermissions" || i === "yolo" ? "bypass" : i, a = {
      plan: "fa-solid fa-clipboard-list",
      default: "fa-solid fa-shield-halved",
      accept: "fa-solid fa-pen-to-square",
      bypass: "fa-solid fa-bolt",
      cowork: "fa-solid fa-people-arrows"
    }, r = {
      plan: t ? "先规划和审阅方案，代码工具以只读能力为主" : "Plan and review first; code tools primarily use read-only capabilities",
      default: t ? "只读工具可用，敏感操作按策略确认" : "Read-only tools remain available; sensitive actions follow approval policy",
      accept: n === "oc" ? t ? "自动执行工作区编辑与命令，保留沙箱边界" : "Automate workspace edits and commands within sandbox boundaries" : t ? "自动接受编辑类操作，其他敏感操作仍确认" : "Auto-accept edits while retaining prompts for other sensitive actions",
      bypass: t ? "直接放行当前引擎的工具操作，请审阅后选择" : "Allow current-engine tool operations directly; review before selecting",
      cowork: t ? "多智能体协作，并使用当前引擎的直接放行权限" : "Multi-agent collaboration with the current engine’s direct tool permissions"
    };
    return {
      id: i,
      label: String(e?.label || i).trim(),
      icon: a[s] || "fa-solid fa-shield-halved",
      desc: r[s] || (t ? "当前引擎提供的权限模式" : "Permission mode from current engine")
    };
  }
  function Nv(e, t) {
    const n = e?.settings || {}, i = Number(n.max_input_tokens || n.context_window || n.contextLimit || 0), s = Number.isFinite(i) && i > 0 ? i : null, a = We(e?.messages), c = a[a.length - 1]?.contextUsage, f = c?.actual === !0 && c?.source === "provider" && Number.isFinite(c.promptTokens) && c.promptTokens >= 0, m = f ? c.promptTokens : Math.round(a.reduce((C, A) => C + String(A?.pure_content || A?.content || "").length, 0) / 1.8), h = s ? Math.min(1, m / s) : 0, w = f ? t ? "上次请求实际输入" : "Last request input" : t ? "估算" : "Estimated";
    return {
      used: m,
      limit: s,
      ratio: h,
      percent: s ? Math.round(h * 100) : null,
      actual: f,
      estimated: !f,
      source: f ? "provider" : "characters",
      warn: !!s && h >= 0.85,
      critical: !!s && h >= 0.92,
      label: `${w} ${cn(m)} / ${s ? cn(s) : t ? "上限未知" : "unknown limit"}`,
      summary: t ? f ? "服务返回的输入 token 数" : "按消息字符估算，包含工具结果时可能偏差较大" : f ? "Input tokens reported by the provider" : "Estimated from message characters; tool output may affect accuracy"
    };
  }
  function cn(e) {
    return !Number.isFinite(e) || e <= 0 ? "0" : e >= 1e6 ? (e / 1e6).toFixed(2) + "M" : e >= 1e3 ? (e / 1e3).toFixed(1) + "k" : String(e);
  }
  function Lv(e, t, n) {
    const i = String(t?.vendor || "").toLowerCase();
    if (!(i === "custom" || i === "openxnet" || String(t?.id || "").includes("custom")))
      return { active: !1 };
    const a = e?.subscriptionCredits || {};
    e?.authState?.gatewayUsage;
    const r = Number(a.dailyRemaining || 0), c = Number(a.dailyQuota || 0), f = Number(a.totalRemaining || a.dailyRemaining || 0), m = String(a.activePlanName || a.activePlanCode || "").trim(), h = c > 0 ? Math.min(1, (c - r) / c) : 0;
    return {
      active: !0,
      dailyRemaining: r,
      dailyQuota: c,
      dailyUsedRatio: h,
      totalRemaining: f,
      bonusCredits: Number(a.bonusCredits || 0),
      topupCredits: Number(a.topupCredits || 0),
      planName: m || (n ? "未订阅" : "Free tier"),
      label: n ? `日 ${cn(r)} 剩余` : `Daily ${cn(r)} left`,
      summary: c > 0 ? n ? `今日 ${cn(r)}/${cn(c)} 积分剩余` : `${cn(r)}/${cn(c)} daily credits left` : n ? "尚未配置每日额度" : "No daily quota configured"
    };
  }
  function Ov(e) {
    const t = Array.isArray(e?.files) ? e.files : [], n = Array.isArray(e?.images) ? e.images : [], i = [];
    return t.forEach((s, a) => {
      s && i.push({
        kind: "file",
        index: a,
        name: String(s.name || ""),
        path: String(s.path || "")
      });
    }), n.forEach((s, a) => {
      s && i.push({
        kind: "image",
        index: a,
        name: String(s.name || ""),
        path: String(s.path || "")
      });
    }), i;
  }
  function Dv(e) {
    if (!e || typeof e.getPrototypeConversationItems != "function")
      return [];
    let t = [];
    try {
      t = e.getPrototypeConversationItems() || [];
    } catch {
      t = [];
    }
    const n = e.conversationId == null ? null : String(e.conversationId);
    return t.map((i) => {
      const s = i?.id == null ? "" : String(i.id);
      let a = "", r = "";
      try {
        a = e.getPrototypeConversationTitle ? e.getPrototypeConversationTitle(i) : "";
      } catch {
      }
      try {
        r = e.getPrototypeConversationPreview ? e.getPrototypeConversationPreview(i) : "";
      } catch {
      }
      let c = "";
      try {
        c = e.formatDate ? e.formatDate(i?.timestamp) : "";
      } catch {
      }
      return {
        id: s,
        title: String(a || i?.title || "").trim() || (e.t ? e.t("untitled") : "Untitled"),
        preview: xv(r || ""),
        time: String(c || ""),
        providerName: String(i?.providerName || i?.providerVendor || "").trim(),
        model: String(i?.model || "").trim(),
        isActive: !!s && s === n
      };
    });
  }
  function Fv() {
    const e = be(), t = Ci(e), n = yv(e) ? Ho(e) : [], i = $v(e, t), s = Dv(e), a = Ov(e), r = Dl(e), c = String(i.providerName || r?.name || "").trim(), f = c ? `${c} · ${String(i.model || ss(t)).trim()}` : String(i.model || ss(t)).trim();
    return {
      isZh: t,
      activeMenu: String(e?.activeMenu || ""),
      conversationId: String(e?.conversationId || "").trim(),
      title: gv(e, t),
      model: i.model,
      modelDisplay: f,
      settings: i,
      messages: n,
      isEmpty: n.length === 0,
      emptyPrompt: Iv(t),
      isSending: !!(e?.isSending || e?.isTyping),
      interpreterEnabled: i.interpreterEnabled,
      asrEnabled: i.asrEnabled,
      canUseHost: !!e,
      conversations: s,
      historyQuery: String(e?.prototypeChatHistoryQuery || ""),
      attachments: a,
      automations: Wo(e),
      recovery: typeof e?.getConversationRecoveryState == "function" ? e.getConversationRecoveryState() : { available: !1, pending: !1, error: "", reason: "" },
      guidance: typeof e?.getLiveGuidanceState == "function" ? e.getLiveGuidanceState() : { available: !1, items: [], error: "", notice: "", loading: !1, sending: !1 },
      connection: go(e)
    };
  }
  function Js(e, t = 1e3) {
    return typeof e != "string" ? "" : jl(e).replace(
      /\bhttps?:\/\/[^\s<>"']+/gi,
      /** 去除URL中的认证和查询。 / Remove URL authentication and query data. */
      (n) => n.split(/[?#]/)[0].replace(/\/\/[^/@]+@/, "//")
    ).replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]").replace(/(["']?(?:api[_-]?key|access[_-]?token|refresh[_-]?token|token|password|passwd|secret|authorization)["']?\s*[:=]\s*)(?:["'][^"'\r\n]*["']|[^\s,;\r\n}]+)/gi, "$1[redacted]").replace(/\b(?:sk-[A-Za-z0-9_-]{12,}|gh[pousr]_[A-Za-z0-9_]{16,})\b/g, "[redacted]").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim().slice(0, t);
  }
  function go(e) {
    const t = { state: "idle", conversationId: String(e?.conversationId || ""), requestId: "", messageId: "", attempt: 0, maxAttempts: 5, message: "", detail: "", canCheck: !1, canContinue: !1 };
    if (typeof e?.getConversationConnectionState != "function") return t;
    const n = e.getConversationConnectionState();
    if (!n || String(n.conversationId || "") !== t.conversationId || !["idle", "offline", "interrupted", "checking", "reachable", "failed"].includes(n.state) || n.workspacePath !== void 0 && Ve(n.workspacePath) !== Ve(e.CLISettings?.cc_path)) return t;
    const i = Number.isInteger(n.maxAttempts) && n.maxAttempts >= 1 && n.maxAttempts <= 5 ? n.maxAttempts : 5, s = e.getConversationRecoveryState?.(), a = typeof n.messageId == "string" ? n.messageId : s?.requestId === n.requestId ? String(s.messageId || "") : "";
    return {
      state: n.state,
      conversationId: t.conversationId,
      requestId: typeof n.requestId == "string" ? n.requestId : "",
      messageId: (e.messages || []).some(
        /** 锚点必须属于当前助手回复。 / The anchor must belong to the current assistant reply. */
        (r) => r.role === "assistant" && String(r.id) === a && (!r.conversationId || String(r.conversationId) === t.conversationId)
      ) ? a : "",
      workspacePath: String(e.CLISettings?.cc_path || ""),
      kind: ["offline", "http", "timeout", "stream", "transport", "auth", "quota", "application"].includes(n.kind) ? n.kind : "",
      httpStatus: Number.isInteger(n.httpStatus) && n.httpStatus >= 100 && n.httpStatus <= 599 ? n.httpStatus : null,
      attempt: Number.isInteger(n.attempt) && n.attempt >= 0 && n.attempt <= i ? n.attempt : 0,
      maxAttempts: i,
      message: Js(n.message, 400),
      detail: Js(n.detail, 1600),
      canCheck: n.canCheck === !0 && typeof e.checkConversationConnection == "function" && n.state !== "checking",
      canContinue: n.canContinue === !0 && s?.available === !0 && s?.pending !== !0 && s.requestId === n.requestId && s.conversationId === n.conversationId,
      continueReason: s?.requestId === n.requestId && s?.conversationId === n.conversationId ? Js(s.reason, 400) : "",
      networkOnline: typeof n.networkOnline == "boolean" ? n.networkOnline : null,
      checkedAt: Number.isFinite(n.checkedAt) ? n.checkedAt : null
    };
  }
  const br = /* @__PURE__ */ new WeakMap();
  async function qv(e) {
    const t = be(), n = go(t), i = JSON.stringify([n.conversationId, n.requestId, Ve(t?.CLISettings?.cc_path)]);
    if (!t || !n.canCheck || e?.conversationId !== n.conversationId || e?.requestId !== n.requestId || Ve(e?.workspacePath) !== Ve(t.CLISettings?.cc_path)) return !1;
    let s = br.get(t);
    if (s || (s = /* @__PURE__ */ new Set(), br.set(t, s)), s.has(i)) return !1;
    s.add(i);
    try {
      await t.checkConversationConnection(n.conversationId, n.requestId);
      const a = go(t);
      return t !== be() || i !== JSON.stringify([a.conversationId, a.requestId, Ve(t.CLISettings?.cc_path)]) ? !1 : a;
    } catch {
      throw new Error(Ci(t) ? "状态检查未完成，请稍后重试。" : "The state check did not complete. Please retry.");
    } finally {
      s.delete(i);
    }
  }
  async function jv(e) {
    const t = be();
    if (!t || typeof t.handleSendOrGuidance != "function") return !1;
    if (!t.isSending && !t.isTyping && (!t.mainAgent || t.mainAgent === "openxnet-model") && !String(t.settings?.model || "").trim())
      throw new Error(Ci(t) ? "请先选择模型" : "Select a model first");
    return t.userInput = String(e || ""), await t.handleSendOrGuidance() === !0;
  }
  async function Bl(e) {
    if (!(!e || typeof e.autoSaveSettings != "function"))
      try {
        await Promise.resolve(e.autoSaveSettings());
      } catch (t) {
        console.warn("[chat-vite] autoSaveSettings failed:", t);
      }
  }
  function Vl(e, t) {
    const n = Zt(t);
    if (!e || !n) return [];
    const i = Ve(n), s = Array.isArray(e.chatRecentProjects) ? e.chatRecentProjects : [], a = [
      { path: n, lastUsed: (/* @__PURE__ */ new Date()).toISOString() },
      ...s.filter((r) => Ve(r?.path || r) !== i)
    ].slice(0, 12);
    return e.chatRecentProjects = a, a;
  }
  function Ul(e, t) {
    const n = Zt(t);
    return !e || !n ? !1 : (e.CLISettings || (e.CLISettings = {}), e.CLISettings.enabled = !0, e.CLISettings.cc_path = n, e.CLISettings.visibilityScope || (e.CLISettings.visibilityScope = "workspace"), e.CLISettings.engine || (e.CLISettings.engine = "local"), !0);
  }
  async function Bo() {
    const e = be();
    return e ? (typeof e.clearMessages == "function" && await Promise.resolve(e.clearMessages()), e.activeMenu = "chat", !0) : !1;
  }
  function Zv() {
    const e = be();
    e && (e.showHistoryDialog = !0);
  }
  function Wl() {
    const e = be();
    if (e) {
      if (typeof e.openModelPicker == "function") {
        e.openModelPicker();
        return;
      }
      e.showModelDialog = !0;
    }
  }
  async function Kl(e) {
    const t = be();
    if (!t || !e) return;
    let n = null;
    try {
      typeof t.findModelProviderById == "function" && (n = t.findModelProviderById(e));
    } catch {
      n = null;
    }
    if (n || (n = We(t?.modelProviders).find((i) => String(i?.id || "") === String(e || "")) || null), n?.isTemplate) {
      typeof t.selectModelProviderForUiplan == "function" && t.selectModelProviderForUiplan(n), Wl();
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
  async function Hv(e, t) {
    const n = be();
    if (!n || !e || !t) return;
    let i = null;
    try {
      typeof n.findModelProviderById == "function" && (i = n.findModelProviderById(e));
    } catch {
      i = null;
    }
    if (i || (i = We(n?.modelProviders).find((a) => String(a?.id || "") === String(e || "")) || null), !i) return;
    i.modelId = String(t || "").trim();
    const s = We(i.models).map((a) => po(n, a)).filter(Boolean);
    i.models = [i.modelId, ...s.filter((a) => a !== i.modelId)], typeof n.handleProviderDraftChange == "function" && await n.handleProviderDraftChange(i.id), await Kl(i.id);
  }
  async function Bv(e) {
    const t = be();
    if (!t || !e) return;
    let n = null;
    try {
      typeof t.findModelProviderById == "function" && (n = t.findModelProviderById(e));
    } catch {
      n = null;
    }
    n || (n = We(t?.modelProviders).find((i) => String(i?.id || "") === String(e || "")) || null), !(!n || typeof t.validateProviderCard != "function") && await t.validateProviderCard(n, { shouldNotify: !0 });
  }
  async function Vv() {
    const e = be();
    !e || typeof e.browseAllFiles != "function" || await e.browseAllFiles();
  }
  async function Uv() {
    const e = be();
    !e || typeof e.browseImages != "function" || await e.browseImages();
  }
  async function Wv() {
    const e = be();
    e && (e.codeSettings || (e.codeSettings = { enabled: !1 }), e.codeSettings.enabled = !e.codeSettings.enabled, typeof e.handleInterpreterToggle == "function" ? await e.handleInterpreterToggle(e.codeSettings.enabled) : typeof e.autoSaveSettings == "function" && await e.autoSaveSettings());
  }
  async function Kv() {
    const e = be();
    if (e) {
      if (typeof e.toggleASR == "function") {
        await e.toggleASR();
        return;
      }
      e.asrSettings && (e.asrSettings.enabled = !e.asrSettings.enabled, typeof e.autoSaveSettings == "function" && await e.autoSaveSettings());
    }
  }
  async function zv() {
    const e = be();
    e && (e.memorySettings || (e.memorySettings = { is_memory: !1 }), e.memorySettings.is_memory = !e.memorySettings.is_memory, typeof e.autoSaveSettings == "function" && await e.autoSaveSettings());
  }
  async function Gv() {
    const e = be();
    if (!e || typeof e.autoSaveSettings != "function") return !1;
    e.memorySettings || (e.memorySettings = {});
    const t = e.memorySettings.synapxnetV3Enabled, n = t === !1;
    e.memorySettings.synapxnetV3Enabled = n;
    try {
      return await e.autoSaveSettings(), !0;
    } catch (i) {
      throw e.memorySettings.synapxnetV3Enabled === n && (e.memorySettings.synapxnetV3Enabled = t), i;
    }
  }
  async function Qv(e) {
    const t = be();
    if (!t) return;
    t.settings || (t.settings = {});
    const n = Number(e);
    t.settings.temperature = Number.isFinite(n) ? Math.max(0, Math.min(2, n)) : 0.7, typeof t.autoSaveSettings == "function" && await t.autoSaveSettings();
  }
  async function Jv(e) {
    const t = be();
    if (!t) return;
    t.settings || (t.settings = {});
    const n = Number(e);
    t.settings.max_tokens = Number.isFinite(n) && n > 0 ? Math.floor(n) : 8192, typeof t.autoSaveSettings == "function" && await t.autoSaveSettings();
  }
  async function Xv(e) {
    const t = be();
    if (!t) return;
    const n = String(e || "");
    t.system_prompt = n, Array.isArray(t.messages) && t.messages.length > 0 && t.messages[0]?.role === "system" && (t.messages[0].content = n), typeof t.autoSaveSettings == "function" && await t.autoSaveSettings();
  }
  async function Yv() {
    const e = be();
    if (e) {
      if (e.webSearchSettings || (e.webSearchSettings = { enabled: !1 }), e.webSearchSettings.enabled = !e.webSearchSettings.enabled, typeof e.handleWebSearchToggle == "function") {
        await e.handleWebSearchToggle(e.webSearchSettings.enabled);
        return;
      }
      typeof e.autoSaveSettings == "function" && await e.autoSaveSettings();
    }
  }
  async function ep() {
    const e = be();
    if (e) {
      if (e.chromeMCPSettings || (e.chromeMCPSettings = { enabled: !1 }), e.chromeMCPSettings.enabled = !e.chromeMCPSettings.enabled, typeof e.changeChromeMCPEnabled == "function") {
        await e.changeChromeMCPEnabled();
        return;
      }
      typeof e.autoSaveSettings == "function" && await e.autoSaveSettings();
    }
  }
  async function tp() {
    const e = be();
    if (e) {
      if (e.ttsSettings || (e.ttsSettings = { enabled: !1 }), e.ttsSettings.enabled = !e.ttsSettings.enabled, typeof e.changeTTSstatus == "function") {
        await e.changeTTSstatus();
        return;
      }
      typeof e.autoSaveSettings == "function" && await e.autoSaveSettings();
    }
  }
  async function np() {
    const e = be();
    e && (e.visionSettings || (e.visionSettings = { desktopVision: !1 }), e.visionSettings.desktopVision = !e.visionSettings.desktopVision, typeof e.autoSaveSettings == "function" && await e.autoSaveSettings());
  }
  async function ip() {
    const e = be();
    !e || typeof e.toggleScreenshot != "function" || await e.toggleScreenshot(!1);
  }
  async function sp() {
    const e = be();
    !e || typeof e.startVRM != "function" || await e.startVRM();
  }
  function op() {
    Vo();
  }
  async function ap(e) {
    const t = be(), n = String(t?.memorySettings?.selectedMemory || "").trim();
    if (!n || !We(t?.memories).some((i) => String(i?.id || "") === n)) throw new Error("请先选择有效角色 / Select a valid role first.");
    if (typeof t.importChatRoleAvatar != "function") throw new Error("头像存储不可用 / Avatar storage unavailable.");
    return t.importChatRoleAvatar(n, e);
  }
  function Vo() {
    const e = be();
    if (e) {
      if (typeof e.openChatRoleCardPanel == "function") {
        e.openChatRoleCardPanel();
        return;
      }
      e.activeMenu = "role", e.subMenu = "memory", e.activeMemoryTab = "config", typeof e.ensurePrototypeRoleSelection == "function" && e.ensurePrototypeRoleSelection();
    }
  }
  async function zl(e) {
    if (e) {
      if (typeof e.changeMemory == "function") {
        await e.changeMemory();
        return;
      }
      typeof e.autoSaveSettings == "function" && await e.autoSaveSettings();
    }
  }
  async function rp(e) {
    const t = be();
    if (!t) return !1;
    const n = String(e || "").trim(), i = We(t.memories).find((s) => String(s?.id || "") === n);
    return i ? (t.memorySettings || (t.memorySettings = { selectedMemory: null, is_memory: !1 }), t.memorySettings.selectedMemory = i.id, t.memorySettings.is_memory = !0, typeof t.selectRoleMemory == "function" && t.selectRoleMemory(i, { persist: !1 }), await zl(t), !0) : (Vo(), !1);
  }
  async function lp() {
    const e = be();
    return e ? (e.memorySettings || (e.memorySettings = { selectedMemory: null, is_memory: !1 }), e.memorySettings.is_memory = !1, await zl(e), !0) : !1;
  }
  async function cp(e) {
    const t = be();
    !t || typeof t.loadConversation != "function" || await t.loadConversation(e);
  }
  async function up(e) {
    const t = be();
    return !t || !e || typeof t.confirmDeleteConversation != "function" ? !1 : await t.confirmDeleteConversation(e) === !0;
  }
  function dp(e) {
    const t = be();
    t && (t.prototypeChatHistoryQuery = String(e || ""));
  }
  async function fp() {
    const e = be();
    if (!e) return !1;
    const t = Zt(e.CLISettings?.cc_path);
    let n = "";
    if (typeof e.handlePrototypeProjectEntry == "function") {
      const s = await e.handlePrototypeProjectEntry();
      n = Zt(s);
    } else if (typeof e.browseDirectory == "function") {
      const s = await e.browseDirectory();
      n = Zt(s);
    }
    const i = Zt(e.CLISettings?.cc_path);
    return !n && i && Ve(i) !== Ve(t) && (n = i), n ? (Ul(e, n), Vl(e, n), await Bo(), await Bl(e), !0) : !1;
  }
  async function vp(e) {
    const t = be(), n = Zt(e?.path || e);
    return !t || !n ? !1 : (Ul(t, n), Vl(t, n), await Bo(), await Bl(t), !0);
  }
  function pp(e) {
    const t = be();
    if (!(!t || typeof t.handleInputPaste != "function"))
      try {
        t.handleInputPaste(e);
      } catch (n) {
        console.warn("[chat-vite] handleInputPaste failed:", n);
      }
  }
  function hp(e) {
    const t = be();
    if (!(!t || !e || typeof t.removeItem != "function")) {
      if (e.kind === "file")
        t.removeItem(e.index, "file");
      else if (e.kind === "image") {
        const n = Array.isArray(t.files) ? t.files.length : 0;
        t.removeItem(n + e.index, "image");
      }
    }
  }
  function gp() {
    const e = be();
    return !e || typeof e.stopGenerate != "function" || !e.isSending && !e.isTyping ? !1 : (e.stopGenerate(), !0);
  }
  async function mp(e = !1) {
    const t = be();
    return !t || t.activeMenu !== "chat" || !t.conversationId || typeof t.refreshLiveGuidanceStatus != "function" ? !1 : !!await t.refreshLiveGuidanceStatus(!0, e);
  }
  function yp() {
    be()?.stopLiveGuidancePolling?.();
  }
  async function bp(e, t, n) {
    const i = be();
    if (!i || typeof i.updateLiveGuidance != "function" || e?.scope !== i.getLiveGuidanceState?.().scope) throw new Error("引导会话已变化或接口不可用 / Guidance conversation changed or its interface is unavailable.");
    return i.updateLiveGuidance(e, t, n);
  }
  async function _p(e) {
    const t = be(), n = t?.getConversationRecoveryState?.();
    return !n?.available || n.pending || typeof t.resumeInterruptedConversation != "function" || e?.conversationId !== n.conversationId || e?.requestId !== n.requestId || Ve(e?.workspacePath) !== Ve(t.CLISettings?.cc_path) ? !1 : await t.resumeInterruptedConversation(n.conversationId, n.requestId) === !0;
  }
  async function wp() {
    const e = be();
    return typeof e?.retryConversationCheckpoint != "function" ? !1 : await e.retryConversationCheckpoint() === !0;
  }
  const Xs = /* @__PURE__ */ new WeakSet();
  async function kp(e, t) {
    const n = be();
    if (!n || !["completionNotificationsEnabled", "completionNotificationSound"].includes(e) || typeof t != "boolean" || typeof window.electronAPI?.saveSystemSettings != "function") return !1;
    if (Xs.has(n)) throw new Error("完成提醒设置正在保存 / Completion preferences are being saved.");
    Xs.add(n);
    try {
      const i = { ...n.systemSettings || {}, completionNotificationsEnabled: n.systemSettings?.completionNotificationsEnabled !== !1, completionNotificationSound: n.systemSettings?.completionNotificationSound === !0, [e]: t }, s = await window.electronAPI.saveSystemSettings(i);
      if (!s?.settings || s.settings[e] !== t) throw new Error("完成提醒设置未获保存确认 / Completion preference saving was not confirmed.");
      return n.systemSettings = { ...n.systemSettings || {}, [e]: t }, !0;
    } finally {
      Xs.delete(n);
    }
  }
  function Vn(e) {
    const t = be();
    if (!t || !e || String(e.conversationId || "").trim() !== String(t.conversationId || "").trim() || Ve(e.workspacePath) !== Ve(t.CLISettings?.cc_path)) throw new Error("文件所属会话或工作区已变化 / The file conversation or workspace has changed.");
    const s = Ho(t).find((a) => a.id === e.messageId)?.activity?.steps?.find((a) => a.id === e.stepId)?.fileChanges?.find((a) => a.id === e.fileId && a.path === e.path);
    if (!s) throw new Error("此文件不属于所选步骤的回执 / This file is not part of the selected step receipt.");
    return { workspacePath: String(t.CLISettings?.cc_path || ""), path: s.path };
  }
  async function xp(e, t) {
    const n = be(), i = String(n?.conversationId || "").trim(), s = Ve(n?.CLISettings?.cc_path), a = () => {
      if (!n || n !== be() || i !== String(n.conversationId || "").trim() || s !== Ve(n.CLISettings?.cc_path)) throw new Error("会话或工作区已变化 / Conversation or workspace changed.");
      const m = Ho(n).find((h) => h.id === e && h.conversationId === i)?.activity?.steps?.find((h) => h.id === t && h.kind === "subagent");
      if (!m?.taskId) throw new Error("当前步骤没有可读取的子任务 / No readable child task is attached to this step.");
      return String(m.taskId);
    }, r = a();
    if (typeof window.electronAPI?.readConversationSubagentTranscript != "function") throw new Error("当前环境不能读取子任务会话 / Child transcripts are unavailable in this environment.");
    const c = await window.electronAPI.readConversationSubagentTranscript({ taskId: r, conversationId: i });
    if (a() !== r || String(c?.conversationId || "") !== i) throw new Error("子任务会话范围已变化 / Child transcript scope changed.");
    return c?.transcript || null;
  }
  const as = /* @__PURE__ */ new WeakMap();
  function Ii(e) {
    return JSON.stringify([String(e?.conversationId || "").trim(), Ve(e?.CLISettings?.cc_path)]);
  }
  function Uo(e) {
    const t = Ii(e);
    let n = as.get(e);
    return (!n || n.scope !== t) && (n = { scope: t, tasks: [], receipts: [], mutations: /* @__PURE__ */ new Set(), coveredRefs: /* @__PURE__ */ new Set(), authoritative: !1, loaded: !1, pending: !1, lastAttempt: 0, error: "", generation: 0 }, as.set(e, n)), n;
  }
  function mo(e, t) {
    const n = e?.details || {}, i = e?.context || n.context || {}, s = e?.automation || i.automation, a = String(e?.originConversationId || i.origin_conversation_id || "").trim(), r = e?.workspacePath || e?.workspace_dir || i.workspace_dir || "";
    if (!s || !a || a !== String(t?.conversationId || "").trim() || r && Ve(r) !== Ve(t?.CLISettings?.cc_path)) return null;
    const c = String(e?.id || e?.core_task_id || e?.task_id || e?.taskId || "").trim();
    if (!c) return null;
    const f = String(e?.legacyTaskId || e?.legacy_task_id || e?.taskId || e?.task_id || c);
    return {
      id: c,
      legacyId: f,
      originConversationId: a,
      scope: Ii(t),
      title: String(e.title || n.title || ""),
      description: String(e.description || n.description || ""),
      state: String(s.state || "unknown"),
      status: String(e.status || n.status || "unknown"),
      scheduleType: String(e.scheduleType || e.schedule_type || n.schedule_type || ""),
      scheduleExpression: String(e.scheduleExpression || e.schedule_expression || n.schedule_expression || ""),
      nextRunAt: String(e.nextRunAt || e.next_run_at || n.next_run_at || ""),
      updatedAt: String(e.updatedAt || e.updated_at || n.updated_at || ""),
      completionCondition: String(s.completion_condition || ""),
      notificationPolicy: String(s.notification_policy || "changes_only"),
      runs: We(s.runs).slice(-50).map((m) => ({ id: String(m.id || ""), outcome: String(m.outcome || "unknown"), summary: String(m.summary || ""), evidence: We(m.evidence).map((h) => typeof h == "string" ? h : JSON.stringify(h)), finishedAt: String(m.finished_at || ""), notify: m.notify === !0, truncated: m.truncated === !0 }))
    };
  }
  function Wo(e) {
    if (!e || e.activeMenu !== "chat" || !e.conversationId) return { tasks: [], error: "", loading: !1, canManage: !1 };
    const t = Uo(e), n = We(e.messages).filter((s) => !s.conversationId || String(s.conversationId) === String(e.conversationId)).flatMap((s) => We(s.taskRefs)), i = [];
    for (const s of [...t.authoritative ? [] : We(e.taskList), ...t.tasks, ...n.filter((a) => !t.coveredRefs.has(JSON.stringify(a))), ...t.receipts]) {
      const a = mo(s, e);
      if (!a) continue;
      const r = i.findIndex((c) => c.id === a.id || c.legacyId === a.legacyId || c.id === a.legacyId || c.legacyId === a.id);
      r < 0 ? i.push(a) : i[r] = { ...i[r], ...a, id: i[r].id !== i[r].legacyId && a.id === a.legacyId ? i[r].id : a.id };
    }
    return { tasks: i.map((s) => ({ ...s, mutationPending: t.mutations.has(s.legacyId) })), error: t.error, loading: t.pending, canManage: typeof window.openxnetChatFetch == "function", canOpenCenter: typeof e.openTaskCenter == "function" };
  }
  function Ko() {
    const e = be(), t = e && as.get(e);
    t && (t.generation += 1, t.pending = !1, t.loaded = !1);
  }
  async function Sp({ open: e = !1, force: t = !1 } = {}) {
    const n = be();
    if (!n || n.activeMenu !== "chat" || !n.conversationId)
      return Ko(), !1;
    const i = Uo(n), s = Date.now();
    if (i.pending || !t && i.loaded && (!e && !Wo(n).tasks.length || s - i.lastAttempt < 5e3)) return !1;
    i.pending = !0, i.loaded = !0, i.lastAttempt = s;
    const a = ++i.generation, r = We(n.messages).flatMap((f) => We(f.taskRefs)).map((f) => JSON.stringify(f)), c = () => n === be() && n.activeMenu === "chat" && as.get(n) === i && Ii(n) === i.scope && i.generation === a;
    try {
      const f = window.openxnetDesktop, m = String(n.CLISettings?.cc_path || "").trim();
      let h;
      if (typeof f?.listTasks == "function") {
        if (h = await f.listTasks(m ? { workspacePath: m } : {}), !c()) return !1;
        Array.isArray(h?.tasks) && (i.tasks = h.tasks), m && typeof f.refreshTaskExecutions == "function" && (h = await f.refreshTaskExecutions({ workspacePath: m }));
      } else if (typeof window.openxnetChatFetch == "function") {
        const w = await window.openxnetChatFetch("/v1/tasks/list");
        if (!w.ok) throw new Error(`任务读取失败 / Task read failed (${w.status}).`);
        h = await w.json();
      } else return !1;
      if (!c()) return !1;
      if (h?.error || !Array.isArray(h?.tasks)) throw new Error(String(h?.error || "任务返回格式无效 / Invalid task response."));
      if (h.workspace_path && Ve(h.workspace_path) !== Ve(m)) throw new Error("任务工作区不匹配 / Task workspace mismatch.");
      return i.tasks = h.tasks, i.receipts = [], i.error = "", i.authoritative = !0, i.coveredRefs = new Set(r), !0;
    } catch (f) {
      return c() && (i.error = f?.message || "任务读取失败 / Task read failed."), !1;
    } finally {
      c() && (i.pending = !1);
    }
  }
  function yo(e) {
    const t = be();
    if (!t || t.activeMenu !== "chat" || !e || e.scope !== Ii(t)) throw new Error("自动任务所属会话已变化 / Automation conversation changed.");
    const n = Wo(t).tasks.find((i) => i.id === e.id && i.legacyId === e.legacyId);
    if (!n) throw new Error("当前会话没有此自动任务 / This automation does not belong to the current conversation.");
    return { host: t, task: n };
  }
  async function Cp(e, t) {
    const { host: n, task: i } = yo(e);
    if (!["pause", "resume", "complete"].includes(t) || typeof window.openxnetChatFetch != "function") throw new Error("自动任务操作不可用 / Automation action unavailable.");
    const s = Uo(n);
    if (s.mutations.has(i.legacyId)) throw new Error("此自动任务正在确认操作 / This automation already has an action pending.");
    s.mutations.add(i.legacyId);
    try {
      const a = await window.openxnetChatFetch("/execute_tool_manually", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tool_name: "update_automation_task", tool_params: { task_id: i.legacyId, action: t }, conversationId: String(n.conversationId), approval_type: "once" }) }), r = await a.json();
      if (yo(e), ["approval_required", "awaiting_approval"].includes(r?.status) || ["approval_required", "awaiting_approval"].includes(r?.type)) return { success: !1, awaitingApproval: !0 };
      if (!a.ok || r?.success !== !0 || ["error", "failed", "rejected"].includes(r?.status)) throw new Error(typeof r?.result == "string" ? r.result : String(r?.error || "自动任务操作失败 / Automation action failed."));
      s.generation += 1, s.pending = !1;
      const c = mo(r.taskRef, n);
      return c && (s.receipts = s.receipts.filter((f) => mo(f, n)?.legacyId !== c.legacyId), s.receipts.push(r.taskRef)), s.lastAttempt = Date.now(), { success: !0 };
    } finally {
      s.mutations.delete(i.legacyId);
    }
  }
  async function Ap(e) {
    const { host: t, task: n } = yo(e);
    return typeof t.openTaskCenter != "function" || (t.openTaskCenter(), Ko(), typeof t.fetchTasks == "function" && await t.fetchTasks(), Ii(t) !== e.scope) ? !1 : (typeof t.fetchTaskDetail == "function" && await t.fetchTaskDetail(n.id), !0);
  }
  const ri = /* @__PURE__ */ new Map();
  function Gl(e) {
    return JSON.stringify([e.conversationId, e.workspacePath, e.messageId, e.stepId, e.fileId, e.path]);
  }
  function Ql(e, t = !1) {
    const n = Vn(e);
    if (!t) return n;
    const i = ri.get(Gl(e));
    if (!i) throw new Error("原生文件授权已失效 / The native file grant is no longer available.");
    return { ...n, path: i.path, grantId: i.grantId };
  }
  function $i() {
    const e = typeof window < "u" ? window.electronAPI : null;
    return { read: typeof e?.readConversationFile == "function", actions: typeof e?.actOnConversationFile == "function", editors: typeof e?.listConversationFileEditors == "function", select: typeof e?.selectConversationFile == "function" };
  }
  async function Ip(e, t = !1) {
    const n = Ql(e, t);
    if (!$i().read) throw new Error("当前环境不能读取本机文件 / Local file reading is unavailable.");
    const i = await window.electronAPI.readConversationFile(n);
    return Vn(e), i;
  }
  async function $p(e) {
    if (Vn(e), !$i().select) throw new Error("当前环境没有原生文件选择 / Native file selection is unavailable.");
    const t = await window.electronAPI.selectConversationFile({ path: e.path });
    if (Vn(e), !t?.canceled) {
      if (typeof t?.grantId != "string" || typeof t?.path != "string") throw new Error("原生文件授权无效 / Invalid native file grant.");
      for (ri.set(Gl(e), { grantId: t.grantId, path: t.path }); ri.size > 32; ) ri.delete(ri.keys().next().value);
    }
    return t;
  }
  async function Mp(e) {
    if (Vn(e), !$i().editors) return [];
    const t = await window.electronAPI.listConversationFileEditors();
    return Vn(e), We(t).filter((n) => n && typeof n.id == "string" && typeof n.label == "string");
  }
  async function Tp(e, t, n = "", i = !1) {
    const s = Ql(e, i);
    if (!["open-default", "reveal", "save-as", "open-editor"].includes(t)) throw new Error("不支持的文件操作 / Unsupported file operation.");
    if (!$i().actions) throw new Error("当前环境没有本机文件操作 / Native file actions are unavailable.");
    return window.electronAPI.actOnConversationFile({ ...s, action: t, ...t === "open-editor" ? { editorId: String(n) } : {} });
  }
  async function Pp(e) {
    const t = be();
    if (!t || typeof t.autoSaveSettings != "function") return !1;
    const n = Ci(t), i = String(e || "").trim();
    if (!Zl(t, n).some((m) => m.value === i)) throw new Error(n ? "当前引擎不支持此权限模式。" : "This permission mode is not supported by the current engine.");
    if (Ki.has(t)) throw new Error(n ? "权限模式正在保存，请稍候。" : "A permission change is being saved. Please wait.");
    const s = Hl(t), a = ho(t), r = !!os.get(t)?.has(a);
    if (i === s && !r) return !0;
    const c = Ai(t), f = ["CLISettings", c.key].map((m) => {
      const h = t[m], w = h && typeof h == "object" && !Array.isArray(h) ? h : {};
      return { key: m, source: h, target: w, hadMode: Object.prototype.hasOwnProperty.call(w, "permissionMode"), mode: w.permissionMode };
    });
    Ki.set(t, { previousMode: s, engine: c.id, scope: a });
    for (const m of f)
      t[m.key] = m.target, m.target.permissionMode = i;
    try {
      const m = await t.autoSaveSettings();
      if (m === !1 || m?.success === !1) throw new Error(n ? "权限模式保存被拒绝。" : "Permission settings were rejected.");
      return Qs(t, a, !1), !0;
    } catch (m) {
      for (const h of f) {
        const w = ho(t) === a, C = t[h.key], A = C === h.target || w ? C : null;
        !A || A.permissionMode !== i || h.key === "CLISettings" && !w || (h.hadMode ? A.permissionMode = h.mode : delete A.permissionMode, h.source !== h.target && !Object.keys(A).length && (h.source === void 0 ? delete t[h.key] : t[h.key] = h.source));
      }
      try {
        const h = await t.autoSaveSettings();
        if (h === !1 || h?.success === !1) throw new Error("Permission rollback rejected");
        Qs(t, a, !1);
      } catch {
        throw Qs(t, a, !0), new Error(n ? "权限保存失败，界面已恢复原模式；请重试以确认运行时设置。" : "Permission saving failed. The previous mode is shown; retry to confirm runtime settings.");
      }
      if (r && i === s) return !0;
      throw m;
    } finally {
      Ki.delete(t);
    }
  }
  async function Ep(e, t) {
    const n = be();
    if (!n || !e) return !1;
    const i = String(t || "").trim();
    return i ? typeof n.renameConversationById == "function" ? await n.renameConversationById(e, i) === !0 : typeof n.renameConversation == "function" ? await n.renameConversation(e, i) === !0 : !1 : !1;
  }
  async function Rp(e) {
    const t = be();
    return !t || !e ? !1 : typeof t.archiveConversationToMemory == "function" ? await t.archiveConversationToMemory(e) === !0 : typeof t.archiveConversation == "function" ? await t.archiveConversation(e) === !0 : !1;
  }
  async function Np(e) {
    if (!e) return !1;
    try {
      return await navigator.clipboard.writeText(String(e)), !0;
    } catch {
      return !1;
    }
  }
  async function Lp(e) {
    const t = be();
    return !t || !e || typeof t.switchGitBranch != "function" ? !1 : await t.switchGitBranch(e) === !0;
  }
  function Op() {
    const e = be();
    e && (typeof e.openUnlockDialog == "function" ? e.openUnlockDialog() : e.showUnlockDialog = !0);
  }
  async function Dp() {
    const e = be();
    if (!e) return !1;
    const t = [];
    return typeof e.refreshCurrentAccessProfile == "function" && t.push(Promise.resolve(e.refreshCurrentAccessProfile({ silent: !0 })).catch(() => !1)), typeof e.refreshSubscriptionAccountState == "function" && t.push(Promise.resolve(e.refreshSubscriptionAccountState({ silent: !0 })).catch(() => !1)), t.length ? (await Promise.all(t), !0) : !1;
  }
  function Fp() {
    return {
      snapshot: Fv,
      sendMessage: jv,
      checkConversationConnection: qv,
      stopResponse: gp,
      refreshGuidance: mp,
      suspendGuidanceRefresh: yp,
      updateGuidance: bp,
      resumeConversationRecovery: _p,
      retryConversationSave: wp,
      setCompletionPreference: kp,
      startNewChat: Bo,
      openHistory: Zv,
      openModelPicker: Wl,
      selectChatProvider: Kl,
      selectChatProviderModel: Hv,
      validateChatProvider: Bv,
      browseAllFiles: Vv,
      browseImages: Uv,
      toggleInterpreter: Wv,
      toggleAsr: Kv,
      toggleMemory: zv,
      toggleNativeMemory: Gv,
      toggleWebSearch: Yv,
      toggleBrowserControl: ep,
      toggleTts: tp,
      toggleDesktopVision: np,
      triggerScreenshot: ip,
      openTablePet: sp,
      openRoleCardPanel: Vo,
      openIdentityConfig: op,
      importRoleAvatar: ap,
      selectRoleCard: rp,
      disableRoleCard: lp,
      setTemperature: Qv,
      setMaxTokens: Jv,
      setSystemPrompt: Xv,
      loadConversation: cp,
      deleteConversation: up,
      setHistoryQuery: dp,
      addProject: fp,
      selectProject: vp,
      handlePaste: pp,
      removeAttachment: hp,
      conversationFileCapabilities: $i,
      readConversationFile: Ip,
      selectConversationFile: $p,
      listConversationFileEditors: Mp,
      actOnConversationFile: Tp,
      readSubagentTranscript: xp,
      refreshAutomations: Sp,
      suspendAutomationRefresh: Ko,
      updateConversationAutomation: Cp,
      openAutomationTaskCenter: Ap,
      setPermissionMode: Pp,
      openSubscriptionCenter: Op,
      refreshCredits: Dp,
      renameConversation: Ep,
      archiveConversation: Rp,
      copyConversationId: Np,
      setGitBranch: Lp
    };
  }
  const In = (e, t) => {
    const n = e.__vccOpts || e;
    for (const [i, s] of t)
      n[i] = s;
    return n;
  }, qp = ["aria-label"], jp = { class: "oxc-worklog__head" }, Zp = ["aria-expanded", "aria-controls"], Hp = {
    key: 0,
    class: "oxc-worklog__file-count"
  }, Bp = { key: 1 }, Vp = {
    key: 2,
    class: "oxc-worklog__duration"
  }, Up = {
    key: 3,
    class: "oxc-worklog__failure"
  }, Wp = {
    key: 4,
    class: "oxc-worklog__approval"
  }, Kp = ["aria-expanded"], zp = ["id"], Gp = { class: "oxc-worklog__row" }, Qp = ["title", "aria-expanded", "aria-controls", "onClick"], Jp = ["d", "transform"], Xp = { class: "oxc-worklog__copy" }, Yp = { class: "oxc-worklog__title" }, eh = { class: "oxc-worklog__meta" }, th = { key: 0 }, nh = { key: 1 }, ih = ["aria-label", "onClick"], sh = { class: "oxc-worklog__file-row" }, oh = ["aria-expanded", "aria-controls", "aria-label", "onClick"], ah = { class: "oxc-worklog__file-operation" }, rh = ["title", "aria-label", "onClick"], lh = {
    key: 0,
    class: "oxc-worklog__line-count is-added"
  }, ch = {
    key: 1,
    class: "oxc-worklog__line-count is-removed"
  }, uh = {
    key: 2,
    class: "oxc-worklog__file-status"
  }, dh = ["id"], fh = { class: "oxc-worklog__status" }, vh = {
    key: 0,
    class: "oxc-worklog__file-origin"
  }, ph = { class: "oxc-worklog__section-head" }, hh = ["disabled", "aria-label", "onClick"], gh = {
    class: "oxc-worklog__record oxc-worklog__diff",
    tabindex: "0"
  }, mh = {
    key: 0,
    class: "oxc-worklog__empty"
  }, yh = {
    key: 1,
    class: "oxc-worklog__copy-feedback is-error",
    role: "status"
  }, bh = {
    key: 1,
    class: "oxc-worklog__empty"
  }, _h = {
    key: 2,
    class: "oxc-worklog__empty"
  }, wh = ["id"], kh = { class: "oxc-worklog__status" }, xh = ["data-section"], Sh = { class: "oxc-worklog__section-head" }, Ch = ["disabled", "aria-label", "onClick"], Ah = {
    key: 0,
    class: "oxc-worklog__record",
    tabindex: "0"
  }, Ih = {
    key: 1,
    class: "oxc-worklog__empty"
  }, $h = {
    key: 1,
    class: "oxc-worklog__waiting"
  }, Mh = {
    __name: "ChatActivity",
    props: { activity: { type: Object, default: null }, isZh: { type: Boolean, default: !0 } },
    emits: ["inspect"],
    setup(e, { emit: t }) {
      const n = e, i = t, s = globalThis.OpenXnetConversationModel, a = /* @__PURE__ */ G(!1), r = /* @__PURE__ */ G(n.activity?.active === !0), c = /* @__PURE__ */ G(/* @__PURE__ */ new Set()), f = /* @__PURE__ */ G(/* @__PURE__ */ new Set()), m = /* @__PURE__ */ G(/* @__PURE__ */ new Map());
      let h = 0, w = 0;
      const C = `chat-activity-${No()}`, A = J(() => Array.isArray(n.activity?.steps) ? n.activity.steps : []), R = J(() => a.value ? A.value : A.value.slice(-3)), P = J(() => R.value.map((H) => ({ step: H, sections: Se(H) }))), E = J(() => A.value.filter((H) => s.normalizeActivityStatus(H.status) === "error").length), Z = J(() => new Set(A.value.flatMap((H) => (H.fileChanges || []).map((B) => B.path))).size), I = J(() => A.value.filter((H) => s.normalizeActivityStatus(H.status) === "awaiting_approval").length);
      vt(() => A.value[0]?.id, V), vt(() => n.activity?.active, (H, B) => {
        B === !0 && H !== !0 ? (r.value = !1, c.value = /* @__PURE__ */ new Set(), f.value = /* @__PURE__ */ new Set()) : H === !0 && B !== !0 && (r.value = !0);
      }), vn(() => {
        h += 1;
      });
      function V() {
        a.value = !1, r.value = n.activity?.active === !0, c.value = /* @__PURE__ */ new Set(), f.value = /* @__PURE__ */ new Set(), m.value = /* @__PURE__ */ new Map(), h += 1;
      }
      function ie(H, B) {
        return !!H && Object.prototype.hasOwnProperty.call(H, B) && H[B] !== void 0 && H[B] !== null;
      }
      function he(H) {
        for (const B of [H, H.input])
          if (!(!B || typeof B != "object" || Array.isArray(B))) {
            for (const j of ["cmd", "command"])
              if (ie(B, j)) return { value: B[j], key: j, nested: B === H.input };
          }
        return null;
      }
      function Se(H) {
        const B = he(H), j = [];
        if (B && j.push({ key: "command", present: !0, text: s.formatDetail(B.value) }), ie(H, "input")) {
          let ce = H.input;
          B?.nested && (ce = Object.fromEntries(Object.entries(ce).filter(([y]) => y !== B.key))), (!B?.nested || Object.keys(ce).length) && j.push({ key: "input", present: !0, text: s.formatDetail(ce) });
        } else B || j.push({ key: "input", present: !1, text: "" });
        return j.push({ key: "output", present: ie(H, "output"), text: s.formatDetail(H.output) }), ie(H, "error") && j.push({ key: "error", present: !0, text: s.formatDetail(H.error) }), j;
      }
      function de(H) {
        return (n.isZh ? { command: "命令", input: "参数", output: "输出", error: "错误" } : { command: "Command", input: "Arguments", output: "Output", error: "Error" })[H];
      }
      function ve(H) {
        return H.present ? n.isZh ? `${de(H.key)}为空` : `${de(H.key)} is empty` : H.key === "output" ? n.isZh ? "暂无输出回执" : "No output receipt available" : n.isZh ? "暂无输入记录" : "No input record available";
      }
      function oe(H) {
        return `${C}-detail-${encodeURIComponent(String(H.id))}`;
      }
      function me(H) {
        c.value.has(H.id) ? c.value.delete(H.id) : c.value.add(H.id);
      }
      function _e(H, B) {
        return JSON.stringify([H.id, B.id || B.path, B.operation]);
      }
      function b(H, B) {
        return `${C}-file-${encodeURIComponent(_e(H, B))}`;
      }
      function T(H, B) {
        const j = _e(H, B);
        f.value.has(j) ? f.value.delete(j) : f.value.add(j);
      }
      function S(H, B) {
        i("inspect", { kind: "file", stepId: H.id, fileId: B.id, path: B.path });
      }
      function K(H) {
        const j = (n.isZh ? { create: "创建", modify: "修改", delete: "删除", rename: "重命名", write: "写入" } : { create: "Create", modify: "Modify", delete: "Delete", rename: "Rename", write: "Write" })[H.operation] || (n.isZh ? "文件操作" : "File operation");
        return n.isZh && H.confirmed ? `已${j}` : j;
      }
      function le(H) {
        return Number.isSafeInteger(H) && H >= 0;
      }
      function F(H) {
        const B = [];
        for (const j of ["diff", "before", "after"]) {
          if (typeof H[j] != "string") continue;
          const ce = n.isZh ? { diff: "差异", before: "变更前", after: "变更后" } : { diff: "Diff", before: "Before", after: "After" };
          B.push({ key: `file-${H.id || H.path}-${j}`, kind: j, label: ce[j], present: !0, text: H[j] });
        }
        return B;
      }
      function ae(H) {
        return H.text.split(`
`).slice(0, 500);
      }
      function Y(H, B) {
        return B !== "diff" ? "" : H.startsWith("@@") ? "is-hunk" : H.startsWith("+") && !H.startsWith("+++") ? "is-added" : H.startsWith("-") && !H.startsWith("---") ? "is-removed" : "";
      }
      function ge(H, B) {
        return JSON.stringify([H.id, B.key]);
      }
      function xe(H, B) {
        const j = m.value.get(ge(H, B));
        return j?.text === B.text ? j.status : "";
      }
      async function z(H, B) {
        const j = ge(H, B), ce = h, y = ++w;
        m.value.set(j, { status: "copying", attempt: y, text: B.text });
        try {
          if (!globalThis.navigator?.clipboard?.writeText) throw new Error("Clipboard unavailable");
          await globalThis.navigator.clipboard.writeText(B.text), h === ce && m.value.get(j)?.attempt === y && m.value.set(j, { status: "copied", attempt: y, text: B.text });
        } catch {
          h === ce && m.value.get(j)?.attempt === y && m.value.set(j, { status: "error", attempt: y, text: B.text });
        }
      }
      function N(H) {
        return !!H.agentId || ["subagent", "sub_agent", "agent"].includes(H.kind);
      }
      function $(H) {
        return s.getActivityStatusLabel(H.status, n.isZh);
      }
      function U(H) {
        const B = s.normalizeActivityStatus(H.status);
        return B === "error" ? "fa-solid fa-circle-exclamation" : B === "done" ? "fa-solid fa-check" : B === "running" ? "fa-solid fa-circle-notch" : B === "awaiting_approval" ? "fa-regular fa-hand" : B === "interrupted" || B === "cancelled" ? "fa-solid fa-pause" : "fa-regular fa-circle";
      }
      function ne(H) {
        i("inspect", { kind: "activity", stepId: H.id });
      }
      function Ze(H) {
        N(H) ? ne(H) : me(H);
      }
      return (H, B) => A.value.length || e.activity?.active ? (p(), g("section", {
        key: 0,
        class: "oxc-worklog",
        "aria-label": e.isZh ? "执行过程" : "Execution activity"
      }, [
        o("div", jp, [
          A.value.length ? (p(), g("button", {
            key: 0,
            type: "button",
            class: "oxc-worklog__toggle",
            "aria-expanded": r.value,
            "aria-controls": `${C}-body`,
            onClick: B[0] || (B[0] = (j) => r.value = !r.value)
          }, [
            o("i", {
              class: se(r.value ? "fa-solid fa-chevron-down" : "fa-solid fa-chevron-right"),
              "aria-hidden": "true"
            }, null, 2),
            o("span", null, u(e.activity?.active ? e.isZh ? "正在处理" : "Working" : e.isZh ? "执行过程" : "Activity"), 1),
            o("span", null, u(e.isZh ? `${A.value.length} 项` : `${A.value.length} steps`), 1),
            Z.value ? (p(), g("span", Hp, u(e.isZh ? `${Z.value} 个文件` : `${Z.value} files`), 1)) : x("", !0)
          ], 8, Zp)) : (p(), g("span", Bp, u(e.isZh ? "正在处理" : "Working"), 1)),
          e.activity?.elapsedLabel ? (p(), g("span", Vp, u(e.activity.elapsedLabel), 1)) : x("", !0),
          E.value ? (p(), g("span", Up, u(e.isZh ? `${E.value} 项失败` : `${E.value} failed`), 1)) : x("", !0),
          I.value ? (p(), g("span", Wp, u(e.isZh ? `${I.value} 项待确认` : `${I.value} awaiting approval`), 1)) : x("", !0),
          r.value && A.value.length > 3 ? (p(), g("button", {
            key: 5,
            type: "button",
            class: "oxc-worklog__expand",
            "aria-expanded": a.value,
            "aria-controls": C,
            onClick: B[1] || (B[1] = (j) => a.value = !a.value)
          }, [
            Fe(u(a.value ? e.isZh ? "收起" : "Collapse" : e.isZh ? `全部 ${A.value.length} 项` : `All ${A.value.length} steps`) + " ", 1),
            o("i", {
              class: se(a.value ? "fa-solid fa-chevron-up" : "fa-solid fa-chevron-down"),
              "aria-hidden": "true"
            }, null, 2)
          ], 8, Kp)) : x("", !0)
        ]),
        r.value ? (p(), g("div", {
          key: 0,
          id: `${C}-body`,
          class: "oxc-worklog__body"
        }, [
          o("ol", {
            id: C,
            class: "oxc-worklog__list"
          }, [
            (p(!0), g(ye, null, Te(P.value, ({ step: j, sections: ce }) => (p(), g("li", {
              key: j.id
            }, [
              o("div", Gp, [
                o("button", {
                  type: "button",
                  class: se(["oxc-worklog__step", `is-${Qe(s).normalizeActivityStatus(j.status)}`]),
                  title: `${j.title || ""} · ${$(j)}`,
                  "aria-expanded": N(j) ? void 0 : c.value.has(j.id),
                  "aria-controls": N(j) ? void 0 : oe(j),
                  onClick: (y) => Ze(j)
                }, [
                  N(j) ? (p(), g("svg", {
                    key: 0,
                    class: se(["oxc-agent-glyph", `is-tone-${Qe(s).agentGlyph(j.agentId || j.taskId || j.id).tone}`]),
                    viewBox: "0 0 24 24",
                    "aria-hidden": "true"
                  }, [
                    o("path", {
                      d: Qe(s).agentGlyph(j.agentId || j.taskId || j.id).path,
                      transform: `rotate(${Qe(s).agentGlyph(j.agentId || j.taskId || j.id).rotation} 12 12)`
                    }, null, 8, Jp)
                  ], 2)) : (p(), g("i", {
                    key: 1,
                    class: se([U(j), "oxc-worklog__icon"]),
                    "aria-hidden": "true"
                  }, null, 2)),
                  o("span", Xp, [
                    o("span", Yp, u(j.title || (e.isZh ? "未命名活动" : "Untitled activity")), 1),
                    o("span", eh, [
                      N(j) ? (p(), g("span", th, u(e.isZh ? "子智能体 · " : "Subagent · "), 1)) : x("", !0),
                      Fe(u($(j)), 1),
                      j.duration ? (p(), g("span", nh, " · " + u(j.duration), 1)) : x("", !0)
                    ])
                  ]),
                  o("i", {
                    class: se([c.value.has(j.id) ? "fa-solid fa-chevron-down" : "fa-solid fa-chevron-right", "oxc-worklog__chevron"]),
                    "aria-hidden": "true"
                  }, null, 2)
                ], 10, Qp),
                o("button", {
                  type: "button",
                  class: "oxc-worklog__inspect",
                  "aria-label": `${e.isZh ? "查看详情" : "Inspect details"} · ${j.title || (e.isZh ? "未命名活动" : "Untitled activity")}`,
                  onClick: (y) => ne(j)
                }, u(e.isZh ? "详情" : "Details"), 9, ih)
              ]),
              (p(!0), g(ye, null, Te(j.fileChanges || [], (y) => (p(), g("div", {
                key: _e(j, y),
                class: "oxc-worklog__file"
              }, [
                o("div", sh, [
                  o("button", {
                    type: "button",
                    class: "oxc-worklog__file-toggle",
                    "aria-expanded": f.value.has(_e(j, y)),
                    "aria-controls": b(j, y),
                    "aria-label": `${e.isZh ? "展开文件变更" : "Expand file change"} · ${y.path}`,
                    onClick: (k) => T(j, y)
                  }, [
                    o("i", {
                      class: se(f.value.has(_e(j, y)) ? "fa-solid fa-chevron-down" : "fa-solid fa-chevron-right"),
                      "aria-hidden": "true"
                    }, null, 2)
                  ], 8, oh),
                  o("i", {
                    class: se(y.operation === "delete" ? "fa-regular fa-trash-can" : "fa-regular fa-file-lines"),
                    "aria-hidden": "true"
                  }, null, 2),
                  o("span", ah, u(K(y)), 1),
                  o("button", {
                    type: "button",
                    class: "oxc-worklog__file-path",
                    title: y.path,
                    "aria-label": `${e.isZh ? "查看文件" : "View file"} · ${y.path}`,
                    onClick: (k) => S(j, y)
                  }, u(y.path), 9, rh),
                  le(y.additions) ? (p(), g("span", lh, "+" + u(y.additions), 1)) : x("", !0),
                  le(y.deletions) ? (p(), g("span", ch, "−" + u(y.deletions), 1)) : x("", !0),
                  y.confirmed ? x("", !0) : (p(), g("span", uh, u($(y)), 1))
                ]),
                f.value.has(_e(j, y)) ? (p(), g("div", {
                  key: 0,
                  id: b(j, y),
                  class: "oxc-worklog__file-detail"
                }, [
                  o("div", fh, [
                    o("span", null, u(y.contentSource === "request" ? e.isZh ? "拟议变更" : "Proposed change" : e.isZh ? "变更详情" : "Change details"), 1),
                    o("span", null, u($(y)), 1)
                  ]),
                  y.previousPath ? (p(), g("p", vh, u(y.previousPath) + " → " + u(y.path), 1)) : x("", !0),
                  (p(!0), g(ye, null, Te(F(y), (k) => (p(), g("div", {
                    key: k.key,
                    class: "oxc-worklog__section"
                  }, [
                    o("div", ph, [
                      o("span", null, u(k.label), 1),
                      o("button", {
                        type: "button",
                        class: "oxc-worklog__copy-action",
                        disabled: xe(j, k) === "copying",
                        "aria-label": `${e.isZh ? "复制" : "Copy "}${k.label} · ${y.path}`,
                        onClick: (M) => z(j, k)
                      }, u(xe(j, k) === "copied" ? e.isZh ? "已复制" : "Copied" : e.isZh ? "复制" : "Copy"), 9, hh)
                    ]),
                    o("pre", gh, [
                      o("code", null, [
                        (p(!0), g(ye, null, Te(ae(k), (M, D) => (p(), g("span", {
                          key: D,
                          class: se(Y(M, k.kind))
                        }, u(M || " "), 3))), 128))
                      ])
                    ]),
                    k.text.split(`
`).length > 500 ? (p(), g("p", mh, u(e.isZh ? "展示前 500 行，可复制已收到的完整内容。" : "Showing the first 500 lines. Copy to access all received text."), 1)) : x("", !0),
                    xe(j, k) === "error" ? (p(), g("span", yh, u(e.isZh ? "复制失败，请选择文本复制" : "Copy failed; select the text to copy it"), 1)) : x("", !0)
                  ]))), 128)),
                  F(y).length ? x("", !0) : (p(), g("p", bh, u(e.isZh ? "此操作未提供可显示的内容差异。" : "No content diff was provided for this operation."), 1)),
                  y.truncated ? (p(), g("p", _h, u(e.isZh ? "变更记录较长，当前仅保留部分内容。" : "This change record is long; only part of it is available."), 1)) : x("", !0)
                ], 8, dh)) : x("", !0)
              ]))), 128)),
              c.value.has(j.id) ? (p(), g("div", {
                key: 0,
                id: oe(j),
                class: "oxc-worklog__disclosure"
              }, [
                o("div", kh, [
                  o("span", null, u(e.isZh ? "状态" : "Status"), 1),
                  o("span", {
                    class: se(`is-${Qe(s).normalizeActivityStatus(j.status)}`)
                  }, u($(j)), 3)
                ]),
                (p(!0), g(ye, null, Te(ce, (y) => (p(), g("div", {
                  key: y.key,
                  class: "oxc-worklog__section",
                  "data-section": y.key
                }, [
                  o("div", Sh, [
                    o("span", null, u(de(y.key)), 1),
                    y.present ? (p(), g("button", {
                      key: 0,
                      type: "button",
                      class: "oxc-worklog__copy-action",
                      disabled: xe(j, y) === "copying",
                      "aria-label": `${e.isZh ? "复制" : "Copy "}${de(y.key)}`,
                      onClick: (k) => z(j, y)
                    }, [
                      B[2] || (B[2] = o("i", {
                        class: "fa-regular fa-copy",
                        "aria-hidden": "true"
                      }, null, -1)),
                      Fe(u(xe(j, y) === "copied" ? e.isZh ? "已复制" : "Copied" : xe(j, y) === "copying" ? e.isZh ? "复制中" : "Copying" : e.isZh ? "复制" : "Copy"), 1)
                    ], 8, Ch)) : x("", !0)
                  ]),
                  y.present && y.text !== "" ? (p(), g("pre", Ah, u(y.text), 1)) : (p(), g("p", Ih, u(ve(y)), 1)),
                  o("span", {
                    class: se(["oxc-worklog__copy-feedback", { "is-error": xe(j, y) === "error" }]),
                    role: "status",
                    "aria-live": "polite"
                  }, u(xe(j, y) === "error" ? e.isZh ? "复制失败，请选择文本复制" : "Copy failed; select the text to copy it" : xe(j, y) === "copied" ? e.isZh ? "已复制到剪贴板" : "Copied to clipboard" : ""), 3)
                ], 8, xh))), 128))
              ], 8, wh)) : x("", !0)
            ]))), 128))
          ])
        ], 8, zp)) : x("", !0),
        !A.value.length && e.activity?.active ? (p(), g("div", $h, [
          B[3] || (B[3] = o("i", {
            class: "fa-regular fa-clock",
            "aria-hidden": "true"
          }, null, -1)),
          Fe(u(e.isZh ? "等待运行回执" : "Waiting for runtime updates"), 1)
        ])) : x("", !0)
      ], 8, qp)) : x("", !0);
    }
  }, Th = /* @__PURE__ */ In(Mh, [["__scopeId", "data-v-f1f3406a"]]), Ph = ["aria-labelledby", "onKeydown"], Eh = { class: "oxc-inspector__head" }, Rh = { class: "oxc-inspector__eyebrow" }, Nh = ["id"], Lh = ["aria-label"], Oh = ["aria-label"], Dh = ["id", "data-inspector-tab", "aria-selected", "aria-controls", "tabindex", "onClick", "onKeydown"], Fh = { key: 0 }, qh = { class: "oxc-inspector__body" }, jh = ["id", "aria-labelledby"], Zh = {
    key: 0,
    class: "oxc-inspector__empty"
  }, Hh = { class: "oxc-inspector__select" }, Bh = ["value"], Vh = ["value"], Uh = ["value"], Wh = {
    key: 0,
    class: "oxc-inspector__empty"
  }, Kh = { class: "oxc-inspector__activity-title" }, zh = { class: "oxc-inspector__kind" }, Gh = {
    key: 0,
    class: "oxc-inspector__agent-glyph",
    viewBox: "0 0 24 24",
    "aria-hidden": "true"
  }, Qh = ["d", "transform"], Jh = {
    key: 1,
    class: "fa-solid fa-terminal",
    "aria-hidden": "true"
  }, Xh = { key: 0 }, Yh = {
    key: 0,
    class: "oxc-inspector__facts"
  }, eg = { key: 0 }, tg = { key: 1 }, ng = {
    key: 1,
    class: "oxc-inspector__description"
  }, ig = {
    key: 2,
    class: "oxc-inspector__transcript"
  }, sg = ["disabled"], og = {
    key: 0,
    class: "oxc-inspector__transcript-error",
    role: "status"
  }, ag = {
    key: 1,
    class: "oxc-inspector__notice"
  }, rg = {
    key: 2,
    class: "oxc-inspector__transcript-list"
  }, lg = ["aria-label", "onClick"], cg = { key: 0 }, ug = {
    key: 3,
    class: "oxc-inspector__notice"
  }, dg = {
    key: 3,
    class: "oxc-inspector__detail"
  }, fg = {
    key: 4,
    class: "oxc-inspector__detail"
  }, vg = {
    key: 5,
    class: "oxc-inspector__detail is-error"
  }, pg = {
    key: 6,
    class: "oxc-inspector__notice"
  }, hg = {
    key: 7,
    class: "oxc-inspector__notice"
  }, gg = ["id", "aria-labelledby"], mg = { class: "oxc-inspector__intro" }, yg = {
    key: 0,
    class: "oxc-inspector__empty"
  }, bg = {
    key: 1,
    class: "oxc-inspector__receipts"
  }, _g = { class: "oxc-inspector__facts" }, wg = { key: 0 }, kg = { key: 1 }, xg = {
    key: 0,
    class: "oxc-inspector__description"
  }, Sg = {
    key: 1,
    class: "oxc-inspector__description"
  }, Cg = {
    key: 2,
    class: "oxc-inspector__provenance"
  }, Ag = { class: "oxc-inspector__facts" }, Ig = { key: 0 }, $g = { key: 1 }, Mg = { key: 2 }, Tg = { key: 3 }, Pg = { key: 4 }, Eg = { key: 5 }, Rg = { class: "oxc-inspector__digest" }, Ng = { key: 6 }, Lg = { class: "oxc-inspector__digest" }, Og = ["id", "aria-labelledby"], Dg = { class: "oxc-inspector__identity" }, Fg = { class: "oxc-inspector__avatar" }, qg = ["src", "alt"], jg = { key: 1 }, Zg = { class: "oxc-inspector__facts" }, Hg = { key: 0 }, Bg = {
    key: 0,
    class: "oxc-inspector__notice"
  }, Vg = { class: "oxc-inspector__attachments" }, Ug = {
    key: 0,
    class: "oxc-inspector__notice"
  }, Wg = { key: 1 }, Kg = ["href"], zg = ["src", "alt", "onError"], Gg = {
    key: 1,
    class: "oxc-inspector__attachment-missing"
  }, Qg = {
    __name: "ConversationInspector",
    props: {
      message: { type: Object, default: null },
      selection: { type: Object, default: null },
      isZh: { type: Boolean, default: !0 },
      loadSubagentTranscript: { type: Function, default: null }
    },
    emits: ["close"],
    setup(e, { emit: t }) {
      const n = e, i = t, s = globalThis.OpenXnetConversationModel, a = /* @__PURE__ */ G("activity"), r = /* @__PURE__ */ G(""), c = /* @__PURE__ */ G(null), f = /* @__PURE__ */ G(/* @__PURE__ */ new Set()), m = `conversation-inspector-${No()}`;
      let h = null;
      const w = /* @__PURE__ */ G(null), C = /* @__PURE__ */ G(!1), A = /* @__PURE__ */ G(""), R = /* @__PURE__ */ G("");
      let P = 0, E = null;
      const Z = J(() => Array.isArray(n.message?.activity?.steps) ? n.message.activity.steps : []), I = J(() => r.value ? Z.value.find((z) => String(z.id) === r.value) || null : Z.value.at(-1) || null), V = J(() => s.normalizeIdentity(n.message?.identity, { fallbackKind: n.message?.role || "unknown" })), ie = J(() => s.normalizeMemoryContext(n.message?.memoryContext).filter((z) => !z.conversationId || !n.message?.conversationId || z.conversationId === n.message.conversationId)), he = J(() => Array.isArray(n.message?.attachments) ? n.message.attachments : []), Se = J(() => !!I.value?.agentId || ["subagent", "sub_agent", "agent"].includes(I.value?.kind)), de = J(() => s.normalizeSubagentTranscript(w.value || I.value?.transcript)), ve = J(() => s.agentGlyph(I.value?.agentId || I.value?.taskId || I.value?.id)), oe = J(() => [
        { id: "activity", label: n.isZh ? "执行过程" : "Activity", icon: "fa-solid fa-list-check", count: Z.value.length },
        { id: "memory", label: n.isZh ? "记忆来源" : "Memory", icon: "fa-solid fa-layer-group", count: ie.value.length },
        { id: "identity", label: n.isZh ? "身份与附件" : "Identity & files", icon: "fa-regular fa-id-badge", count: null }
      ]);
      vt(() => [n.message?.id, n.selection?.kind, n.selection?.stepId], () => {
        a.value = ["activity", "memory", "identity"].includes(n.selection?.kind) ? n.selection.kind : "activity", r.value = String(n.selection?.stepId || ""), f.value = /* @__PURE__ */ new Set();
      }, { immediate: !0 }), vt(() => [n.message?.id, I.value?.id, a.value], () => {
        P += 1, w.value = null, A.value = "", C.value = !1, R.value = "", a.value === "activity" && Se.value && _e();
      }, { immediate: !0 }), Un(async () => {
        h = typeof document < "u" ? document.activeElement : null, await nt(), c.value?.focus?.({ preventScroll: !0 }), E = setInterval(() => {
          a.value === "activity" && Se.value && ["running", "pending"].includes(s.normalizeActivityStatus(I.value?.status)) && _e();
        }, 4e3);
      }), Lo(() => {
        P += 1, clearInterval(E), h?.isConnected && typeof h.focus == "function" && h.focus({ preventScroll: !0 });
      });
      function me() {
        i("close");
      }
      async function _e() {
        if (C.value || !Se.value || !I.value?.taskId || typeof n.loadSubagentTranscript != "function") return;
        const z = P, N = n.message?.id, $ = I.value.id;
        C.value = !0, A.value = "";
        try {
          const U = await n.loadSubagentTranscript(N, $);
          if (z !== P) return;
          w.value = U;
        } catch (U) {
          z === P && (A.value = U?.message || (n.isZh ? "协作记录读取失败。" : "Could not read collaboration records."));
        } finally {
          z === P && (C.value = !1);
        }
      }
      function b(z) {
        return (n.isZh ? { parent: "主模型 → 子智能体", subagent: "子智能体 → 主模型", tool: "工具回执", runtime: "运行时继续指令" } : { parent: "Parent → Subagent", subagent: "Subagent → Parent", tool: "Tool receipt", runtime: "Runtime continuation" })[z.role] || z.role;
      }
      async function T(z) {
        const N = P;
        try {
          await navigator.clipboard.writeText(z.content), N === P && (R.value = z.id);
        } catch {
          N === P && (A.value = n.isZh ? "复制失败，请选择文本复制。" : "Copy failed; select the text to copy it.");
        }
      }
      async function S(z, N) {
        if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(z.key)) return;
        const $ = oe.value.findIndex((ne) => ne.id === N), U = z.key === "Home" ? 0 : z.key === "End" ? oe.value.length - 1 : ($ + (z.key === "ArrowRight" ? 1 : -1) + oe.value.length) % oe.value.length;
        a.value = oe.value[U].id, z.preventDefault(), await nt(), c.value?.querySelector(`[data-inspector-tab="${a.value}"]`)?.focus();
      }
      function K(z) {
        return s.getActivityStatusLabel(z?.status, n.isZh);
      }
      function le(z) {
        const N = {
          injected: ["已注入本轮", "Injected this turn"],
          retrieved: ["已检索", "Retrieved"],
          skipped: ["本轮未使用", "Not used this turn"],
          not_used: ["本轮未使用", "Not used this turn"],
          disabled: ["未启用", "Disabled"],
          error: ["读取失败", "Read failed"],
          failed: ["读取失败", "Read failed"],
          empty: ["未检索到内容", "No content found"],
          unavailable: ["暂不可用", "Unavailable"],
          unknown: ["状态未记录", "Status not recorded"]
        };
        return (N[z.status] || N.unknown)[n.isZh ? 0 : 1];
      }
      function F(z) {
        const N = {
          disabled: ["长期记忆未启用。", "Long-term memory is disabled."],
          sub_agent: ["此子智能体未注入长期记忆。", "Long-term memory was not injected for this subagent."],
          empty_query: ["本轮没有可用于检索的输入。", "This turn has no retrieval input."],
          no_match: ["未找到相关记忆。", "No matching memory was found."],
          worker_unavailable: ["记忆服务暂不可用。", "The memory service is unavailable."],
          recall_failed: ["记忆检索未成功。", "Memory retrieval failed."]
        };
        return N[z] ? N[z][n.isZh ? 0 : 1] : z;
      }
      function ae(z) {
        const N = { "synapxnet-memory-v3": ["原生记忆 V3", "Native Memory V3"], long_term: ["长期记忆", "Long-term memory"], role_profile: ["角色档案", "Role profile"], unknown: ["未记录", "Not recorded"] };
        return N[z] ? N[z][n.isZh ? 0 : 1] : z;
      }
      function Y(z) {
        return s.safeImageUrl(z.url || z.path || z.src);
      }
      function ge(z) {
        f.value = /* @__PURE__ */ new Set([...f.value, z]);
      }
      function xe(z) {
        const N = { message: ["消息记录", "Message record"], role_card: ["角色档案", "Role profile"], employee: ["企业员工", "Enterprise employee"], runtime: ["运行回执", "Runtime receipt"], unknown: ["来源未记录", "Source not recorded"] };
        return N[z] ? N[z][n.isZh ? 0 : 1] : z;
      }
      return (z, N) => (p(), g("aside", {
        ref_key: "panelRef",
        ref: c,
        class: "oxc-inspector",
        tabindex: "-1",
        "aria-labelledby": `${m}-title`,
        onKeydown: Ol(Re(me, ["stop"]), ["esc"])
      }, [
        o("header", Eh, [
          o("div", null, [
            o("span", Rh, u(e.isZh ? "本条消息" : "THIS MESSAGE"), 1),
            o("h2", {
              id: `${m}-title`
            }, u(e.isZh ? "工作详情" : "Work details"), 9, Nh)
          ]),
          o("button", {
            type: "button",
            class: "oxc-inspector__close",
            "aria-label": e.isZh ? "关闭详情" : "Close details",
            onClick: me
          }, [...N[2] || (N[2] = [
            o("i", {
              class: "fa-solid fa-xmark",
              "aria-hidden": "true"
            }, null, -1)
          ])], 8, Lh)
        ]),
        o("div", {
          role: "tablist",
          class: "oxc-inspector__tabs",
          "aria-label": e.isZh ? "详情类型" : "Detail category"
        }, [
          (p(!0), g(ye, null, Te(oe.value, ($) => (p(), g("button", {
            id: `${m}-tab-${$.id}`,
            key: $.id,
            type: "button",
            role: "tab",
            "data-inspector-tab": $.id,
            "aria-selected": a.value === $.id,
            "aria-controls": `${m}-panel-${$.id}`,
            tabindex: a.value === $.id ? 0 : -1,
            onClick: (U) => a.value = $.id,
            onKeydown: (U) => S(U, $.id)
          }, [
            o("i", {
              class: se($.icon),
              "aria-hidden": "true"
            }, null, 2),
            o("span", null, u($.label), 1),
            $.count ? (p(), g("small", Fh, u($.count), 1)) : x("", !0)
          ], 40, Dh))), 128))
        ], 8, Oh),
        o("div", qh, [
          a.value === "activity" ? (p(), g("section", {
            key: 0,
            id: `${m}-panel-activity`,
            role: "tabpanel",
            "aria-labelledby": `${m}-tab-activity`
          }, [
            Z.value.length ? (p(), g(ye, { key: 1 }, [
              o("label", Hh, [
                o("span", null, u(e.isZh ? "选择活动" : "Select activity"), 1),
                o("select", {
                  value: I.value?.id || r.value,
                  onChange: N[0] || (N[0] = ($) => r.value = String($.target.value))
                }, [
                  r.value && !I.value ? (p(), g("option", {
                    key: 0,
                    value: r.value
                  }, u(e.isZh ? "原记录已不可用" : "Original record unavailable"), 9, Vh)) : x("", !0),
                  (p(!0), g(ye, null, Te(Z.value, ($) => (p(), g("option", {
                    key: $.id,
                    value: $.id
                  }, u($.title || (e.isZh ? "活动" : "Activity")) + " · " + u(K($)), 9, Uh))), 128))
                ], 40, Bh)
              ]),
              I.value ? (p(), g(ye, { key: 1 }, [
                o("div", Kh, [
                  o("span", zh, [
                    Se.value ? (p(), g("svg", Gh, [
                      o("path", {
                        d: ve.value.path,
                        transform: `rotate(${ve.value.rotation} 12 12)`
                      }, null, 8, Qh)
                    ])) : (p(), g("i", Jh)),
                    Fe(u(Se.value ? e.isZh ? "子智能体" : "Subagent" : e.isZh ? "活动记录" : "Activity record"), 1)
                  ]),
                  o("h3", null, u(I.value.title || (e.isZh ? "未命名活动" : "Untitled activity")), 1),
                  o("div", {
                    class: se(["oxc-inspector__status", `is-${Qe(s).normalizeActivityStatus(I.value.status)}`])
                  }, [
                    o("span", null, u(K(I.value)), 1),
                    I.value.duration ? (p(), g("small", Xh, u(I.value.duration), 1)) : x("", !0)
                  ], 2)
                ]),
                I.value.agentId || I.value.taskId ? (p(), g("dl", Yh, [
                  I.value.agentId ? (p(), g("div", eg, [
                    o("dt", null, u(e.isZh ? "智能体" : "Agent"), 1),
                    o("dd", null, u(I.value.agentId), 1)
                  ])) : x("", !0),
                  I.value.taskId ? (p(), g("div", tg, [
                    o("dt", null, u(e.isZh ? "关联任务" : "Linked task"), 1),
                    o("dd", null, u(I.value.taskId), 1)
                  ])) : x("", !0)
                ])) : x("", !0),
                I.value.detail ? (p(), g("p", ng, u(Qe(s).formatDetail(I.value.detail)), 1)) : x("", !0),
                Se.value ? (p(), g("section", ig, [
                  o("header", null, [
                    o("h4", null, u(e.isZh ? "协作对话" : "Collaboration conversation"), 1),
                    e.loadSubagentTranscript && I.value.taskId ? (p(), g("button", {
                      key: 0,
                      type: "button",
                      disabled: C.value,
                      onClick: _e
                    }, u(C.value ? e.isZh ? "读取中" : "Loading" : e.isZh ? "刷新" : "Refresh"), 9, sg)) : x("", !0)
                  ]),
                  A.value ? (p(), g("p", og, u(A.value), 1)) : x("", !0),
                  !de.value.length && !C.value ? (p(), g("p", ag, u(e.isZh ? "暂无已记录的协作消息；下方仍可查看已有输入和输出。" : "No recorded collaboration messages are available. Existing input and output remain below."), 1)) : (p(), g("ol", rg, [
                    (p(!0), g(ye, null, Te(de.value, ($) => (p(), g("li", {
                      key: $.id,
                      class: se(`is-${$.role}`)
                    }, [
                      o("header", null, [
                        o("strong", null, u(b($)), 1),
                        o("button", {
                          type: "button",
                          "aria-label": `${e.isZh ? "复制协作消息" : "Copy collaboration message"} · ${$.id}`,
                          onClick: (U) => T($)
                        }, u(R.value === $.id ? e.isZh ? "已复制" : "Copied" : e.isZh ? "复制" : "Copy"), 9, lg)
                      ]),
                      $.toolName ? (p(), g("small", cg, u($.toolName), 1)) : x("", !0),
                      o("pre", null, u($.content), 1)
                    ], 2))), 128))
                  ])),
                  w.value?.truncated ? (p(), g("p", ug, u(e.isZh ? "历史记录较长，当前显示已保留的部分。" : "The history is long; showing the retained portion."), 1)) : x("", !0)
                ])) : x("", !0),
                Qe(s).formatDetail(I.value.input) ? (p(), g("section", dg, [
                  o("h4", null, u(e.isZh ? "输入" : "Input"), 1),
                  o("pre", null, u(Qe(s).formatDetail(I.value.input)), 1)
                ])) : x("", !0),
                Qe(s).formatDetail(I.value.output) ? (p(), g("section", fg, [
                  o("h4", null, u(Se.value ? e.isZh ? "交付结果" : "Delivery" : e.isZh ? "输出" : "Output"), 1),
                  o("pre", null, u(Qe(s).formatDetail(I.value.output)), 1)
                ])) : x("", !0),
                Qe(s).formatDetail(I.value.error) ? (p(), g("section", vg, [
                  o("h4", null, u(e.isZh ? "错误详情" : "Error details"), 1),
                  o("pre", null, u(Qe(s).formatDetail(I.value.error)), 1)
                ])) : x("", !0),
                !Qe(s).formatDetail(I.value.input) && !Qe(s).formatDetail(I.value.output) && !Qe(s).formatDetail(I.value.error) ? (p(), g("p", pg, u(e.isZh ? "这条记录未附带输入或输出详情。" : "This record has no input or output details."), 1)) : x("", !0),
                Qe(s).normalizeActivityStatus(I.value.status) === "awaiting_approval" ? (p(), g("p", hg, u(e.isZh ? "此处展示等待状态，请在原授权卡片中处理确认。" : "Approval is pending. Use the original approval card to respond."), 1)) : x("", !0)
              ], 64)) : (p(), g("div", Wh, [
                o("strong", null, u(e.isZh ? "所选记录已不可用" : "Selected record is unavailable"), 1),
                o("p", null, u(e.isZh ? "可从上方选择仍保留的活动。" : "Select an available activity above."), 1)
              ]))
            ], 64)) : (p(), g("div", Zh, [
              N[3] || (N[3] = o("i", {
                class: "fa-regular fa-clock",
                "aria-hidden": "true"
              }, null, -1)),
              o("strong", null, u(e.isZh ? "暂无活动回执" : "No activity receipts"), 1),
              o("p", null, u(e.isZh ? "工具或子智能体的实际运行记录会显示在这里。" : "Actual tool and subagent activity appears here when available."), 1)
            ]))
          ], 8, jh)) : a.value === "memory" ? (p(), g("section", {
            key: 1,
            id: `${m}-panel-memory`,
            role: "tabpanel",
            "aria-labelledby": `${m}-tab-memory`
          }, [
            o("p", mg, u(e.isZh ? "这里显示本条消息的实际记忆回执。角色和长期记忆的开关不代表本轮已注入。" : "These are receipts for this message. Enabling a role or long-term memory does not establish injection for this turn."), 1),
            ie.value.length ? (p(), g("ol", bg, [
              (p(!0), g(ye, null, Te(ie.value, ($) => (p(), g("li", {
                key: $.id
              }, [
                o("header", null, [
                  o("strong", null, u(ae($.source)), 1),
                  o("span", {
                    class: se({ "is-error": ["error", "failed"].includes($.status) })
                  }, u(le($)), 3)
                ]),
                o("dl", _g, [
                  o("div", null, [
                    o("dt", null, u(e.isZh ? "类型" : "Type"), 1),
                    o("dd", null, u(ae($.type)), 1)
                  ]),
                  $.count !== null ? (p(), g("div", wg, [
                    o("dt", null, u(e.isZh ? "条目" : "Items"), 1),
                    o("dd", null, u($.count), 1)
                  ])) : x("", !0),
                  $.characters !== null ? (p(), g("div", kg, [
                    o("dt", null, u(e.isZh ? "字符" : "Characters"), 1),
                    o("dd", null, u($.characters), 1)
                  ])) : x("", !0)
                ]),
                $.reason ? (p(), g("p", xg, u(F($.reason)), 1)) : x("", !0),
                $.detail ? (p(), g("p", Sg, u($.detail), 1)) : x("", !0),
                $.items.length ? (p(), g("details", Cg, [
                  o("summary", null, [
                    Fe(u(e.isZh ? "查看来源与版本" : "View sources and versions") + " ", 1),
                    o("span", null, u($.items.length), 1)
                  ]),
                  (p(!0), g(ye, null, Te($.items, (U, ne) => (p(), g("div", {
                    key: `${U.memoryId}:${ne}`,
                    class: "oxc-inspector__memory-item"
                  }, [
                    o("h4", null, u(U.title || (e.isZh ? "记忆条目" : "Memory item")), 1),
                    o("dl", Ag, [
                      U.memoryId ? (p(), g("div", Ig, [
                        o("dt", null, u(e.isZh ? "条目标识" : "Memory ID"), 1),
                        o("dd", null, u(U.memoryId), 1)
                      ])) : x("", !0),
                      U.version ? (p(), g("div", $g, [
                        o("dt", null, u(e.isZh ? "版本" : "Version"), 1),
                        o("dd", null, u(U.version), 1)
                      ])) : x("", !0),
                      U.ownerAgent ? (p(), g("div", Mg, [
                        o("dt", null, u(e.isZh ? "所属智能体" : "Owner agent"), 1),
                        o("dd", null, u(U.ownerAgent), 1)
                      ])) : x("", !0),
                      U.taskId ? (p(), g("div", Tg, [
                        o("dt", null, u(e.isZh ? "关联任务" : "Linked task"), 1),
                        o("dd", null, u(U.taskId), 1)
                      ])) : x("", !0),
                      U.characters !== null ? (p(), g("div", Pg, [
                        o("dt", null, u(e.isZh ? "注入字符" : "Characters"), 1),
                        o("dd", null, u(U.characters), 1)
                      ])) : x("", !0),
                      U.recordSha256 ? (p(), g("div", Eg, [
                        o("dt", null, u(e.isZh ? "记录指纹" : "Record digest"), 1),
                        o("dd", Rg, u(U.recordSha256), 1)
                      ])) : x("", !0),
                      U.injectedContentSha256 ? (p(), g("div", Ng, [
                        o("dt", null, u(e.isZh ? "注入指纹" : "Injection digest"), 1),
                        o("dd", Lg, u(U.injectedContentSha256), 1)
                      ])) : x("", !0)
                    ])
                  ]))), 128))
                ])) : x("", !0)
              ]))), 128))
            ])) : (p(), g("div", yg, [
              N[4] || (N[4] = o("i", {
                class: "fa-regular fa-folder-open",
                "aria-hidden": "true"
              }, null, -1)),
              o("strong", null, u(e.isZh ? "暂无本轮记忆回执" : "No memory receipts for this turn"), 1),
              o("p", null, u(e.isZh ? "没有回执时，无法确认哪些记忆参与了这次回复。" : "Without receipts, the memory used in this reply is unknown."), 1)
            ]))
          ], 8, gg)) : (p(), g("section", {
            key: 2,
            id: `${m}-panel-identity`,
            role: "tabpanel",
            "aria-labelledby": `${m}-tab-identity`
          }, [
            o("div", Dg, [
              o("div", Fg, [
                V.value.image && !f.value.has("identity") ? (p(), g("img", {
                  key: 0,
                  src: V.value.image,
                  alt: V.value.name || (e.isZh ? "消息头像" : "Message avatar"),
                  onError: N[1] || (N[1] = ($) => ge("identity"))
                }, null, 40, qg)) : (p(), g("span", jg, u(V.value.text), 1))
              ]),
              o("div", null, [
                o("h3", null, u(V.value.name || (e.isZh ? "身份未记录" : "Identity not recorded")), 1),
                o("p", null, u(xe(V.value.source)), 1)
              ])
            ]),
            o("dl", Zg, [
              o("div", null, [
                o("dt", null, u(e.isZh ? "消息角色" : "Message role"), 1),
                o("dd", null, u(e.message?.role === "assistant" ? e.isZh ? "助手" : "Assistant" : e.message?.role === "user" ? e.isZh ? "用户" : "User" : e.message?.role || (e.isZh ? "未知" : "Unknown")), 1)
              ]),
              V.value.id ? (p(), g("div", Hg, [
                o("dt", null, u(e.isZh ? "身份标识" : "Identity ID"), 1),
                o("dd", null, u(V.value.id), 1)
              ])) : x("", !0)
            ]),
            !V.value.id && !V.value.name ? (p(), g("p", Bg, u(e.isZh ? "历史消息未保存身份时，会保留未知状态。" : "Historical messages without a saved identity remain unknown."), 1)) : x("", !0),
            o("section", Vg, [
              o("h4", null, [
                Fe(u(e.isZh ? "本条消息的附件" : "Attachments for this message"), 1),
                o("span", null, u(he.value.length), 1)
              ]),
              he.value.length ? (p(), g("ul", Wg, [
                (p(!0), g(ye, null, Te(he.value, ($, U) => (p(), g("li", {
                  key: $.id || U
                }, [
                  Y($) ? (p(), g("a", {
                    key: 0,
                    href: Y($),
                    target: "_blank",
                    rel: "noopener noreferrer"
                  }, [
                    $.kind === "image" && !f.value.has(U) ? (p(), g("img", {
                      key: 0,
                      src: Y($),
                      alt: $.name || (e.isZh ? "图片附件" : "Image attachment"),
                      loading: "lazy",
                      onError: (ne) => ge(U)
                    }, null, 40, zg)) : (p(), g("i", {
                      key: 1,
                      class: se($.kind === "image" ? "fa-regular fa-image" : "fa-regular fa-file-lines"),
                      "aria-hidden": "true"
                    }, null, 2)),
                    o("span", null, u($.name || (e.isZh ? `附件 ${U + 1}` : `Attachment ${U + 1}`)), 1),
                    N[5] || (N[5] = o("i", {
                      class: "fa-solid fa-arrow-up-right-from-square",
                      "aria-hidden": "true"
                    }, null, -1))
                  ], 8, Kg)) : (p(), g("span", Gg, [
                    N[6] || (N[6] = o("i", {
                      class: "fa-regular fa-file",
                      "aria-hidden": "true"
                    }, null, -1)),
                    Fe(u($.name || (e.isZh ? `附件 ${U + 1}` : `Attachment ${U + 1}`)), 1),
                    o("small", null, u(e.isZh ? "地址不可用" : "Address unavailable"), 1)
                  ]))
                ]))), 128))
              ])) : (p(), g("p", Ug, u(e.isZh ? "没有附件记录。" : "No attachment records."), 1))
            ])
          ], 8, Og))
        ])
      ], 40, Ph));
    }
  }, Jg = /* @__PURE__ */ In(Qg, [["__scopeId", "data-v-456df90b"]]), Xg = ["aria-label"], Yg = { class: "oxc-file-preview__head" }, em = ["aria-label"], tm = ["aria-label"], nm = ["title", "aria-selected", "tabindex", "data-file-key", "onClick", "onKeydown"], im = ["aria-label", "onClick"], sm = { class: "oxc-file-preview__path" }, om = ["title"], am = {
    key: 0,
    "aria-hidden": "true"
  }, rm = ["aria-label"], lm = { class: "oxc-file-preview__toolbar" }, cm = { class: "oxc-file-preview__views" }, um = ["data-file-view", "aria-pressed", "onClick"], dm = ["disabled"], fm = ["disabled"], vm = {
    key: 2,
    class: "oxc-file-preview__open-shell"
  }, pm = ["aria-expanded", "disabled"], hm = {
    key: 0,
    class: "oxc-file-preview__open-menu"
  }, gm = ["disabled"], mm = ["disabled"], ym = ["disabled"], bm = {
    key: 1,
    role: "status"
  }, _m = ["data-file-editor", "disabled", "onClick"], wm = { class: "oxc-file-preview__source" }, km = { key: 0 }, xm = {
    key: 0,
    class: "oxc-file-preview__error",
    role: "alert"
  }, Sm = {
    key: 1,
    class: "oxc-file-preview__notice",
    role: "status"
  }, Cm = {
    key: 2,
    class: "oxc-file-preview__empty"
  }, Am = {
    key: 3,
    class: "oxc-file-preview__empty"
  }, Im = ["aria-label"], $m = {
    class: "oxc-file-preview__number",
    "aria-hidden": "true"
  }, Mm = ["innerHTML"], Tm = {
    key: 0,
    class: "oxc-file-preview__empty"
  }, Pm = {
    key: 1,
    class: "oxc-file-preview__empty"
  }, _r = 2e5, wr = 2e3, Em = {
    __name: "FilePreviewPanel",
    props: { tabs: { type: Array, default: () => [] }, activeKey: { type: String, default: "" }, isZh: { type: Boolean, default: !0 }, bridge: { type: Object, required: !0 } },
    emits: ["select", "close-tab", "close"],
    setup(e, { emit: t }) {
      const n = e, i = t, s = /* @__PURE__ */ G(null), a = /* @__PURE__ */ G(null), r = /* @__PURE__ */ G("diff"), c = /* @__PURE__ */ G(!1), f = /* @__PURE__ */ G(!1), m = /* @__PURE__ */ G(""), h = /* @__PURE__ */ G(""), w = /* @__PURE__ */ G(!1), C = /* @__PURE__ */ G([]), A = /* @__PURE__ */ G(!1);
      let R = 0, P = null;
      const E = J(() => n.tabs.find((N) => N.key === n.activeKey) || null), Z = J(() => E.value?.file || null), I = J(() => n.bridge.conversationFileCapabilities?.() || {});
      function V(N, $) {
        return !!N && typeof N[$] == "string";
      }
      const ie = J(() => [
        { id: "diff", label: n.isZh ? "差异" : "Diff", available: V(Z.value, "diff") },
        { id: "after", label: n.isZh ? "变更后" : "After", available: V(Z.value, "after") },
        { id: "before", label: n.isZh ? "变更前" : "Before", available: V(Z.value, "before") },
        { id: "disk", label: n.isZh ? "本机文件" : "Local file", available: !!a.value }
      ].filter((N) => N.available)), he = J(() => r.value === "disk" ? a.value?.source === "selected-file" ? n.isZh ? "用户选择文件" : "User-selected file" : n.isZh ? "当前磁盘内容" : "Current disk content" : Z.value?.contentSource === "request" ? n.isZh ? "拟议内容 · 来自工具输入" : "Proposed content · tool input" : n.isZh ? "工具回执内容" : "Tool receipt content"), Se = J(() => r.value === "disk" && a.value?.path ? a.value.path : E.value?.path || ""), de = J(() => Se.value.replace(/\\/g, "/").split("/").filter(Boolean)), ve = J(() => r.value === "disk" ? a.value?.content : Z.value?.[r.value]), oe = J(() => typeof ve.value == "string" ? ve.value.slice(0, _r).split(`
`).slice(0, wr) : []), me = J(() => (r.value === "disk" ? a.value?.truncated : Z.value?.truncated) || typeof ve.value == "string" && (ve.value.length > _r || ve.value.split(`
`).length > wr)), _e = J(() => {
        if (r.value === "diff") return "diff";
        const N = Se.value.split(".").at(-1)?.toLowerCase();
        return { py: "python", js: "javascript", cjs: "javascript", mjs: "javascript", ts: "typescript", tsx: "typescript", jsx: "javascript", vue: "xml", html: "xml", htm: "xml", yml: "yaml", md: "markdown", sh: "bash", ps1: "powershell", cs: "csharp", cc: "cpp", h: "cpp", rs: "rust" }[N] || N || "plaintext";
      }), b = J(() => r.value === "disk" && !!a.value?.canOpenDefault), T = J(() => oe.value.map((N, $) => ({ number: $ + 1, html: le(N) || " ", tone: F(N) })));
      vt(() => [E.value?.key, E.value?.scope, E.value?.stepId, E.value?.fileId, !!Z.value].join("::"), () => {
        R += 1, a.value = null, c.value = !1, f.value = !1, m.value = "", h.value = "", w.value = !1, C.value = [], A.value = !1, r.value = V(Z.value, "diff") ? "diff" : V(Z.value, "after") ? "after" : V(Z.value, "before") ? "before" : "";
      }, { immediate: !0 }), Un(async () => {
        P = typeof document > "u" ? null : document.activeElement, await nt(), s.value?.focus?.({ preventScroll: !0 });
      }), vn(() => {
        R += 1, P?.isConnected && P.focus?.({ preventScroll: !0 });
      });
      function S(N) {
        return String(N || "").replace(/\\/g, "/").split("/").at(-1) || (n.isZh ? "文件" : "File");
      }
      function K(N) {
        return String(N).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
      }
      function le(N) {
        const $ = globalThis.hljs || globalThis.window?.hljs;
        try {
          if ($?.getLanguage?.(_e.value)) return $.highlight(N, { language: _e.value, ignoreIllegals: !0 }).value;
        } catch {
        }
        return K(N);
      }
      function F(N) {
        return r.value !== "diff" ? "" : N.startsWith("+") && !N.startsWith("+++") ? "is-add" : N.startsWith("-") && !N.startsWith("---") ? "is-remove" : N.startsWith("@@") ? "is-hunk" : "";
      }
      async function ae(N = !1) {
        if (!E.value || !Z.value || c.value) return;
        const $ = R, U = E.value;
        c.value = !0, m.value = "", h.value = "";
        try {
          const ne = N ? await n.bridge.selectConversationFile(U) : await n.bridge.readConversationFile(U);
          if ($ !== R) return;
          if (ne?.canceled) {
            h.value = n.isZh ? "已取消选择" : "Selection canceled";
            return;
          }
          if (!ne || !ne.binary && typeof ne.content != "string") throw new Error(n.isZh ? "未收到文件内容" : "No file content was returned");
          a.value = ne, r.value = "disk";
        } catch (ne) {
          $ === R && (m.value = ne?.message || (n.isZh ? "文件读取失败" : "File reading failed"));
        } finally {
          $ === R && (c.value = !1);
        }
      }
      async function Y() {
        if (w.value = !w.value, !w.value || !I.value.editors || !E.value) return;
        const N = R;
        A.value = !0;
        try {
          const $ = await n.bridge.listConversationFileEditors(E.value);
          N === R && (C.value = $);
        } catch ($) {
          N === R && (m.value = $?.message || (n.isZh ? "编辑器列表读取失败" : "Editor discovery failed"));
        } finally {
          N === R && (A.value = !1);
        }
      }
      async function ge(N, $ = "") {
        if (!E.value || !Z.value || f.value) return;
        const U = R;
        f.value = !0, m.value = "", h.value = "";
        try {
          const ne = await n.bridge.actOnConversationFile(E.value, N, $, r.value === "disk" && a.value?.source === "selected-file");
          if (U !== R) return;
          if (ne?.canceled) h.value = n.isZh ? "已取消" : "Canceled";
          else {
            if (ne?.success !== !0) throw new Error(n.isZh ? "操作未完成" : "The action did not complete");
            h.value = n.isZh ? "操作已完成" : "Action completed", w.value = !1;
          }
        } catch (ne) {
          U === R && (m.value = ne?.message || (n.isZh ? "文件操作失败" : "File action failed"));
        } finally {
          U === R && (f.value = !1);
        }
      }
      async function xe() {
        const N = R;
        try {
          if (!globalThis.navigator?.clipboard?.writeText) throw new Error("Clipboard unavailable");
          await globalThis.navigator.clipboard.writeText(Se.value), N === R && (h.value = n.isZh ? "路径已复制" : "Path copied");
        } catch {
          N === R && (m.value = n.isZh ? "复制失败，请选择路径文本复制" : "Copy failed; select the path text to copy it");
        }
      }
      function z(N, $) {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(N.key)) return;
        const U = n.tabs.findIndex((Ze) => Ze.key === $), ne = N.key === "Home" ? 0 : N.key === "End" ? n.tabs.length - 1 : (U + (N.key === "ArrowRight" ? 1 : -1) + n.tabs.length) % n.tabs.length;
        N.preventDefault(), i("select", n.tabs[ne].key);
      }
      return (N, $) => (p(), g("aside", {
        ref_key: "panelRef",
        ref: s,
        class: "oxc-file-preview",
        tabindex: "-1",
        "aria-label": e.isZh ? "文件预览" : "File preview",
        onKeydown: $[6] || ($[6] = Ol(Re((U) => i("close"), ["stop"]), ["esc"]))
      }, [
        o("header", Yg, [
          o("span", null, [
            $[7] || ($[7] = o("i", {
              class: "fa-regular fa-file-code",
              "aria-hidden": "true"
            }, null, -1)),
            Fe(u(e.isZh ? "文件预览" : "File preview"), 1)
          ]),
          o("button", {
            type: "button",
            class: "oxc-file-preview__close",
            "aria-label": e.isZh ? "关闭文件预览" : "Close file preview",
            onClick: $[0] || ($[0] = (U) => i("close"))
          }, [...$[8] || ($[8] = [
            o("i", {
              class: "fa-solid fa-xmark",
              "aria-hidden": "true"
            }, null, -1)
          ])], 8, em)
        ]),
        o("div", {
          class: "oxc-file-preview__tabs",
          role: "tablist",
          "aria-label": e.isZh ? "已打开文件" : "Open files"
        }, [
          (p(!0), g(ye, null, Te(e.tabs, (U) => (p(), g("div", {
            key: U.key,
            class: se(["oxc-file-preview__tab-shell", { "is-active": U.key === e.activeKey }])
          }, [
            o("button", {
              type: "button",
              class: "oxc-file-preview__tab",
              role: "tab",
              title: U.path,
              "aria-selected": U.key === e.activeKey,
              tabindex: U.key === e.activeKey ? 0 : -1,
              "data-file-key": U.key,
              onClick: (ne) => i("select", U.key),
              onKeydown: (ne) => z(ne, U.key)
            }, u(S(U.path)), 41, nm),
            o("button", {
              type: "button",
              class: "oxc-file-preview__tab-close",
              "aria-label": `${e.isZh ? "关闭" : "Close "}${S(U.path)}`,
              onClick: (ne) => i("close-tab", U.key)
            }, [...$[9] || ($[9] = [
              o("i", {
                class: "fa-solid fa-xmark",
                "aria-hidden": "true"
              }, null, -1)
            ])], 8, im)
          ], 2))), 128))
        ], 8, tm),
        E.value && Z.value ? (p(), g(ye, { key: 0 }, [
          o("div", sm, [
            o("div", {
              class: "oxc-file-preview__breadcrumbs",
              title: Se.value
            }, [
              (p(!0), g(ye, null, Te(de.value, (U, ne) => (p(), g(ye, { key: ne }, [
                ne ? (p(), g("span", am, "/")) : x("", !0),
                o("span", null, u(U), 1)
              ], 64))), 128))
            ], 8, om),
            o("button", {
              type: "button",
              class: "oxc-file-preview__copy-path",
              "aria-label": e.isZh ? "复制路径" : "Copy path",
              onClick: xe
            }, [...$[10] || ($[10] = [
              o("i", {
                class: "fa-regular fa-copy",
                "aria-hidden": "true"
              }, null, -1)
            ])], 8, rm)
          ]),
          o("div", lm, [
            o("div", cm, [
              (p(!0), g(ye, null, Te(ie.value, (U) => (p(), g("button", {
                key: U.id,
                type: "button",
                class: se({ "is-active": r.value === U.id }),
                "data-file-view": U.id,
                "aria-pressed": r.value === U.id,
                onClick: (ne) => r.value = U.id
              }, u(U.label), 11, um))), 128))
            ]),
            I.value.read ? (p(), g("button", {
              key: 0,
              type: "button",
              class: "oxc-file-preview__read",
              disabled: c.value,
              onClick: $[1] || ($[1] = (U) => ae(!1))
            }, u(c.value ? e.isZh ? "读取中…" : "Reading…" : e.isZh ? "读取当前文件" : "Read current file"), 9, dm)) : x("", !0),
            I.value.select ? (p(), g("button", {
              key: 1,
              type: "button",
              class: "oxc-file-preview__select",
              disabled: c.value,
              onClick: $[2] || ($[2] = (U) => ae(!0))
            }, u(e.isZh ? "选择文件预览" : "Select file"), 9, fm)) : x("", !0),
            I.value.actions ? (p(), g("div", vm, [
              o("button", {
                type: "button",
                class: "oxc-file-preview__open",
                "aria-expanded": w.value,
                disabled: f.value,
                onClick: Y
              }, [
                Fe(u(e.isZh ? "打开" : "Open"), 1),
                $[11] || ($[11] = o("i", {
                  class: "fa-solid fa-chevron-down",
                  "aria-hidden": "true"
                }, null, -1))
              ], 8, pm),
              w.value ? (p(), g("div", hm, [
                b.value ? (p(), g("button", {
                  key: 0,
                  type: "button",
                  "data-file-action": "open-default",
                  disabled: f.value,
                  onClick: $[3] || ($[3] = (U) => ge("open-default"))
                }, u(e.isZh ? "使用系统默认打开" : "Open with default app"), 9, gm)) : x("", !0),
                o("button", {
                  type: "button",
                  "data-file-action": "reveal",
                  disabled: f.value,
                  onClick: $[4] || ($[4] = (U) => ge("reveal"))
                }, u(e.isZh ? "在文件夹中显示" : "Show in folder"), 9, mm),
                o("button", {
                  type: "button",
                  "data-file-action": "save-as",
                  disabled: f.value,
                  onClick: $[5] || ($[5] = (U) => ge("save-as"))
                }, u(e.isZh ? "另存副本…" : "Save a copy…"), 9, ym),
                A.value ? (p(), g("span", bm, u(e.isZh ? "正在查找编辑器…" : "Finding editors…"), 1)) : x("", !0),
                (p(!0), g(ye, null, Te(C.value, (U) => (p(), g("button", {
                  key: U.id,
                  type: "button",
                  "data-file-editor": U.id,
                  disabled: f.value,
                  onClick: (ne) => ge("open-editor", U.id)
                }, u(U.label), 9, _m))), 128))
              ])) : x("", !0)
            ])) : x("", !0)
          ]),
          o("div", wm, [
            Fe(u(he.value), 1),
            me.value ? (p(), g("span", km, " · " + u(e.isZh ? "预览已截断" : "Preview truncated"), 1)) : x("", !0)
          ]),
          m.value ? (p(), g("p", xm, u(m.value), 1)) : x("", !0),
          h.value ? (p(), g("p", Sm, u(h.value), 1)) : x("", !0),
          r.value === "disk" && a.value?.binary ? (p(), g("div", Cm, u(e.isZh ? "这是二进制文件，可通过已安装的应用打开。" : "This binary file can be opened with an installed app."), 1)) : typeof ve.value != "string" ? (p(), g("div", Am, u(I.value.read || I.value.select ? e.isZh ? "这条回执没有文件正文。可读取当前文件，或选择本机文件预览。" : "This receipt has no file content. Read the current file or select a local file to preview." : e.isZh ? "这条回执没有文件正文，当前环境仅支持回执预览。" : "This receipt has no file content; this environment supports receipt previews only."), 1)) : (p(), g("div", {
            key: 4,
            class: "oxc-file-preview__code",
            role: "region",
            tabindex: "0",
            "aria-label": `${S(Se.value)} · ${he.value}`
          }, [
            (p(!0), g(ye, null, Te(T.value, (U) => (p(), g("div", {
              key: U.number,
              class: se(["oxc-file-preview__line", U.tone])
            }, [
              o("span", $m, u(U.number), 1),
              o("code", {
                class: "oxc-file-preview__text hljs",
                innerHTML: U.html
              }, null, 8, Mm)
            ], 2))), 128)),
            ve.value === "" ? (p(), g("div", Tm, u(e.isZh ? "文件内容为空" : "The file is empty"), 1)) : x("", !0)
          ], 8, Im))
        ], 64)) : (p(), g("p", Pm, u(e.isZh ? "所选文件回执已不可用。" : "The selected file receipt is no longer available."), 1))
      ], 40, Xg));
    }
  }, Rm = /* @__PURE__ */ In(Em, [["__scopeId", "data-v-f3d2b0b5"]]), Nm = {
    class: "oxc-automation-panel",
    "aria-label": "自动任务详情 / Automation details"
  }, Lm = { class: "oxc-automation-panel__eyebrow" }, Om = ["aria-label"], Dm = { class: "oxc-automation-panel__body" }, Fm = {
    key: 0,
    role: "status"
  }, qm = { class: "oxc-automation-panel__state" }, jm = ["data-automation-state"], Zm = { class: "oxc-automation-panel__prompt" }, Hm = {
    key: 0,
    class: "oxc-automation-panel__actions"
  }, Bm = ["disabled"], Vm = ["disabled"], Um = ["disabled"], Wm = {
    key: 1,
    role: "status"
  }, Km = {
    key: 2,
    role: "status"
  }, zm = {
    key: 3,
    class: "oxc-automation-panel__error",
    role: "alert"
  }, Gm = { class: "oxc-automation-panel__section-heading" }, Qm = ["disabled", "aria-label"], Jm = {
    key: 0,
    class: "oxc-automation-panel__error",
    role: "alert"
  }, Xm = { key: 1 }, Ym = ["data-automation-run"], ey = { key: 0 }, ty = { key: 1 }, ny = { key: 0 }, iy = ["disabled"], sy = {
    __name: "AutomationPanel",
    props: { task: { type: Object, default: null }, isZh: { type: Boolean, default: !0 }, bridge: { type: Object, required: !0 }, canManage: Boolean, canOpenCenter: Boolean, refreshError: { type: String, default: "" }, loading: Boolean },
    emits: ["close", "changed", "refresh"],
    setup(e, { emit: t }) {
      const n = e, i = t, s = /* @__PURE__ */ G(""), a = /* @__PURE__ */ G(""), r = /* @__PURE__ */ G(""), c = J(() => !!s.value || !!n.task?.mutationPending);
      let f = 0;
      vt(() => [n.task?.scope, n.task?.id], () => {
        f += 1, s.value = "", a.value = "", r.value = "";
      }), vn(() => {
        f += 1;
      });
      const m = J(() => w(n.task?.state)), h = J(() => [...n.task?.runs || []].reverse());
      function w(P) {
        return { active: ["进行中", "Active"], paused: ["已暂停", "Paused"], completed: ["已结束", "Completed"], running: ["执行中", "Running"], pending: ["等待执行", "Pending"], failed: ["失败", "Failed"], error: ["失败", "Failed"], unchanged: ["未发生变化", "Unchanged"], changed: ["有新变化", "Changed"], action_required: ["需要处理", "Action required"], changes_only: ["有变化时通知", "Notify on changes"], all: ["每次通知", "Notify every run"], silent: ["仅保留记录", "History only"] }[P]?.[n.isZh ? 0 : 1] || P || (n.isZh ? "未提供" : "Not provided");
      }
      function C(P) {
        if (!P) return n.isZh ? "未安排" : "Not scheduled";
        const E = new Date(P);
        return Number.isNaN(E.getTime()) ? P : E.toLocaleString(n.isZh ? "zh-CN" : "en-US");
      }
      async function A(P) {
        if (!n.task || c.value || !n.canManage) return;
        const E = n.task, Z = ++f;
        s.value = P, a.value = "", r.value = "";
        try {
          const I = await n.bridge.updateConversationAutomation(E, P);
          if (Z !== f) return;
          if (I?.awaitingApproval) r.value = n.isZh ? "等待确认，任务状态尚未改变。" : "Awaiting approval; task state has not changed.";
          else if (I?.success === !0)
            r.value = n.isZh ? "操作已确认。" : "Action confirmed.", i("changed");
          else throw new Error(n.isZh ? "操作没有获得成功确认。" : "The action was not confirmed successful.");
        } catch (I) {
          Z === f && (a.value = I?.message || (n.isZh ? "操作失败，请重试。" : "Action failed. Please retry."));
        } finally {
          Z === f && (s.value = "");
        }
      }
      async function R() {
        if (!n.task || c.value) return;
        const P = ++f;
        s.value = "center", a.value = "";
        try {
          const E = await n.bridge.openAutomationTaskCenter(n.task);
          if (P === f && E === !1) throw new Error(n.isZh ? "任务中心不可用。" : "Task center unavailable.");
        } catch (E) {
          P === f && (a.value = E?.message || "Task center unavailable.");
        } finally {
          P === f && (s.value = "");
        }
      }
      return (P, E) => (p(), g("aside", Nm, [
        o("header", null, [
          o("div", null, [
            o("span", Lm, [
              E[5] || (E[5] = o("i", {
                class: "fa-regular fa-clock",
                "aria-hidden": "true"
              }, null, -1)),
              Fe(u(e.isZh ? "自动任务" : "Automation"), 1)
            ]),
            o("h2", null, u(e.task?.title || (e.isZh ? "任务详情" : "Task details")), 1)
          ]),
          o("button", {
            type: "button",
            "aria-label": e.isZh ? "关闭自动任务详情" : "Close automation details",
            onClick: E[0] || (E[0] = (Z) => i("close"))
          }, [...E[6] || (E[6] = [
            o("i", {
              class: "fa-solid fa-xmark",
              "aria-hidden": "true"
            }, null, -1)
          ])], 8, Om)
        ]),
        o("div", Dm, [
          e.task ? (p(), g(ye, { key: 1 }, [
            o("div", qm, [
              o("strong", {
                "data-automation-state": e.task.state
              }, u(m.value), 9, jm),
              o("span", null, u(e.isZh ? "本次执行" : "Current execution") + " · " + u(w(e.task.status)), 1)
            ]),
            o("section", null, [
              o("h3", null, u(e.isZh ? "任务要求" : "Instructions"), 1),
              o("p", Zm, u(e.task.description || (e.isZh ? "任务尚未提供具体要求。" : "No instructions were provided.")), 1)
            ]),
            o("dl", null, [
              o("dt", null, u(e.isZh ? "执行计划" : "Schedule"), 1),
              o("dd", null, u(e.task.scheduleExpression || e.task.scheduleType || (e.isZh ? "未提供" : "Not provided")), 1),
              o("dt", null, u(e.isZh ? "下一次检查" : "Next check"), 1),
              o("dd", null, u(e.task.state === "active" ? C(e.task.nextRunAt) : e.isZh ? "当前未启用后续检查" : "Future checks are inactive"), 1),
              o("dt", null, u(e.isZh ? "完成条件" : "Completion condition"), 1),
              o("dd", null, u(e.task.completionCondition || (e.isZh ? "未提供" : "Not provided")), 1),
              o("dt", null, u(e.isZh ? "通知方式" : "Notifications"), 1),
              o("dd", null, u(w(e.task.notificationPolicy)), 1)
            ]),
            e.canManage && e.task.state !== "completed" ? (p(), g("div", Hm, [
              e.task.state === "active" ? (p(), g("button", {
                key: 0,
                type: "button",
                "data-automation-action": "pause",
                disabled: c.value,
                onClick: E[1] || (E[1] = (Z) => A("pause"))
              }, [
                E[7] || (E[7] = o("i", {
                  class: "fa-solid fa-pause",
                  "aria-hidden": "true"
                }, null, -1)),
                Fe(u(e.isZh ? "暂停" : "Pause"), 1)
              ], 8, Bm)) : x("", !0),
              e.task.state === "paused" ? (p(), g("button", {
                key: 1,
                type: "button",
                "data-automation-action": "resume",
                disabled: c.value,
                onClick: E[2] || (E[2] = (Z) => A("resume"))
              }, [
                E[8] || (E[8] = o("i", {
                  class: "fa-solid fa-play",
                  "aria-hidden": "true"
                }, null, -1)),
                Fe(u(e.isZh ? "恢复" : "Resume"), 1)
              ], 8, Vm)) : x("", !0),
              o("button", {
                type: "button",
                "data-automation-action": "complete",
                disabled: c.value,
                onClick: E[3] || (E[3] = (Z) => A("complete"))
              }, [
                E[9] || (E[9] = o("i", {
                  class: "fa-solid fa-check",
                  "aria-hidden": "true"
                }, null, -1)),
                Fe(u(e.isZh ? "结束任务" : "Complete task"), 1)
              ], 8, Um)
            ])) : x("", !0),
            c.value ? (p(), g("p", Wm, u(e.isZh ? "正在确认…" : "Confirming…"), 1)) : x("", !0),
            r.value ? (p(), g("p", Km, u(r.value), 1)) : x("", !0),
            a.value ? (p(), g("p", zm, u(a.value), 1)) : x("", !0),
            o("section", null, [
              o("div", Gm, [
                o("h3", null, [
                  Fe(u(e.isZh ? "运行记录" : "Run history") + " ", 1),
                  o("span", null, u(h.value.length), 1)
                ]),
                o("button", {
                  type: "button",
                  disabled: e.loading || c.value,
                  "aria-label": e.isZh ? "刷新运行记录" : "Refresh run history",
                  onClick: E[4] || (E[4] = (Z) => i("refresh"))
                }, [
                  o("i", {
                    class: se(e.loading ? "fa-solid fa-spinner fa-spin" : "fa-solid fa-rotate"),
                    "aria-hidden": "true"
                  }, null, 2)
                ], 8, Qm)
              ]),
              e.refreshError ? (p(), g("p", Jm, u(e.refreshError), 1)) : x("", !0),
              h.value.length ? x("", !0) : (p(), g("p", Xm, u(e.isZh ? "还没有实际运行记录。" : "No actual runs have been recorded."), 1)),
              (p(!0), g(ye, null, Te(h.value, (Z) => (p(), g("article", {
                key: Z.id,
                class: "oxc-automation-run",
                "data-automation-run": Z.id
              }, [
                o("div", null, [
                  o("strong", null, u(w(Z.outcome)), 1),
                  o("time", null, u(C(Z.finishedAt)), 1)
                ]),
                o("small", null, u(e.isZh ? "自动任务结果" : "Automation result"), 1),
                o("p", null, u(Z.summary || (e.isZh ? "没有提供结果摘要。" : "No result summary provided.")), 1),
                Z.truncated ? (p(), g("small", ey, u(e.isZh ? "摘要或依据已截断，可在任务中心查看完整记录。" : "Summary or evidence shortened; open the task center for the full record."), 1)) : x("", !0),
                Z.evidence.length ? (p(), g("details", ty, [
                  o("summary", null, u(e.isZh ? "查看依据" : "View evidence") + " · " + u(Z.evidence.length), 1),
                  o("ul", null, [
                    (p(!0), g(ye, null, Te(Z.evidence, (I, V) => (p(), g("li", { key: V }, u(I), 1))), 128))
                  ])
                ])) : x("", !0)
              ], 8, Ym))), 128))
            ])
          ], 64)) : (p(), g("p", Fm, u(e.isZh ? "此任务已不在当前会话中。" : "This task is no longer available in this conversation."), 1))
        ]),
        e.task && e.canOpenCenter ? (p(), g("footer", ny, [
          o("button", {
            type: "button",
            disabled: c.value,
            "data-automation-action": "center",
            onClick: R
          }, [
            Fe(u(e.isZh ? "在任务中心查看" : "View in task center"), 1),
            E[10] || (E[10] = o("i", {
              class: "fa-solid fa-arrow-up-right-from-square",
              "aria-hidden": "true"
            }, null, -1))
          ], 8, iy)
        ])) : x("", !0)
      ]));
    }
  }, oy = /* @__PURE__ */ In(sy, [["__scopeId", "data-v-72ef4c45"]]), ay = ["aria-label"], ry = { key: 0 }, ly = ["disabled", "aria-label"], cy = { class: "oxc-guidance-queue__hint" }, uy = {
    key: 0,
    class: "oxc-guidance-queue__hint"
  }, dy = {
    key: 1,
    class: "oxc-guidance-queue__hint"
  }, fy = {
    key: 2,
    class: "oxc-guidance-queue__rows"
  }, vy = ["data-guidance-id", "data-guidance-state"], py = { key: 0 }, hy = { class: "oxc-guidance-queue__actions" }, gy = ["disabled", "aria-label", "onClick"], my = ["disabled", "aria-label", "onClick"], yy = ["onClick"], by = {
    key: 4,
    class: "oxc-guidance-queue__editor"
  }, _y = ["for"], wy = ["id", "value", "disabled", "aria-label"], ky = ["disabled"], xy = ["disabled"], Sy = {
    key: 5,
    class: "oxc-guidance-queue__error",
    role: "alert"
  }, Cy = {
    key: 6,
    class: "oxc-guidance-queue__hint",
    role: "status"
  }, Ay = {
    __name: "GuidanceQueue",
    props: { state: { type: Object, required: !0 }, isZh: { type: Boolean, default: !0 }, running: Boolean, bridge: { type: Object, required: !0 } },
    emits: ["changed", "restore-text"],
    setup(e, { emit: t }) {
      const n = e, i = t, s = /* @__PURE__ */ G(!1), a = /* @__PURE__ */ G(null), r = /* @__PURE__ */ G(""), c = /* @__PURE__ */ G(""), f = /* @__PURE__ */ G("");
      let m = 0;
      const h = J(() => (n.state.items || []).filter((Z) => Z.state === "pending").length), w = J(() => s.value ? [...n.state.items || []].reverse() : [...n.state.items || []].slice(-3).reverse());
      vt(() => n.state.scope, () => {
        m += 1, a.value = null, r.value = "", c.value = "", f.value = "", s.value = !1;
      }), vn(() => {
        m += 1;
      });
      function C(Z) {
        return { pending: ["待接收", "Pending"], consumed: ["已接收", "Received"], canceled: ["已撤回", "Withdrawn"], lost: ["需重新提交", "Resubmit needed"] }[Z]?.[n.isZh ? 0 : 1] || (n.isZh ? "状态未知" : "Unknown");
      }
      function A(Z) {
        c.value || Z.mutationPending || Z.state !== "pending" || (a.value = { ...Z, scope: n.state.scope }, r.value = Z.text, f.value = "", s.value = !0);
      }
      function R() {
        c.value || (a.value = null, r.value = "", f.value = "");
      }
      async function P() {
        try {
          await n.bridge.refreshGuidance?.(!0), i("changed");
        } catch (Z) {
          f.value = Z?.message || "引导状态不可用 / Guidance state unavailable.";
        }
      }
      async function E(Z, I) {
        if (c.value || Z.mutationPending) return;
        const V = ++m, ie = { ...Z, scope: n.state.scope };
        c.value = Z.guidance_id, f.value = "";
        try {
          const he = await n.bridge.updateGuidance(ie, I, I === "edit" ? r.value : "");
          if (V !== m) return;
          if (he?.success !== !0) throw new Error(n.isZh ? "操作尚未确认。" : "The action was not confirmed.");
          a.value?.guidance_id === Z.guidance_id && (a.value = null, r.value = "");
        } catch (he) {
          V === m && (f.value = he?.message || (n.isZh ? "操作失败，编辑内容已保留。" : "Action failed; your edit is preserved."));
        } finally {
          V === m && (c.value = "", i("changed"));
        }
      }
      return (Z, I) => e.running || e.state.items?.length || e.state.error || e.state.notice ? (p(), g("section", {
        key: 0,
        class: "oxc-guidance-queue",
        "aria-label": e.isZh ? "会话引导" : "Conversation guidance"
      }, [
        o("header", null, [
          o("span", null, [
            I[4] || (I[4] = o("i", {
              class: "fa-solid fa-route",
              "aria-hidden": "true"
            }, null, -1)),
            o("strong", null, u(e.isZh ? "会话引导" : "Guidance"), 1),
            h.value ? (p(), g("small", ry, u(h.value) + " " + u(e.isZh ? "条待接收" : "pending"), 1)) : x("", !0)
          ]),
          o("button", {
            type: "button",
            "data-guidance-action": "refresh",
            disabled: e.state.loading || !!c.value,
            "aria-label": e.isZh ? "刷新引导状态" : "Refresh guidance state",
            onClick: P
          }, [
            o("i", {
              class: se(e.state.loading ? "fa-solid fa-spinner fa-spin" : "fa-solid fa-rotate"),
              "aria-hidden": "true"
            }, null, 2)
          ], 8, ly)
        ]),
        o("p", cy, u(e.running ? e.isZh ? "补充要求不会停止当前回复，可在后续受支持的检查点接收。" : "Add instructions without stopping the reply; supported later checkpoints can receive them." : e.isZh ? "本轮回复已结束，待接收引导仍保留在队列中。" : "This reply has ended; pending guidance remains queued."), 1),
        e.state.supported === !1 ? (p(), g("p", uy, u(e.state.unavailableReason || (e.isZh ? "当前执行方式不支持实时引导。" : "The current execution mode does not support live guidance.")), 1)) : !e.state.available && !e.state.loading ? (p(), g("p", dy, u(e.isZh ? "引导连接尚未就绪，发送失败会保留草稿。" : "Guidance is not connected yet; failed submissions keep their drafts."), 1)) : x("", !0),
        w.value.length ? (p(), g("div", fy, [
          (p(!0), g(ye, null, Te(w.value, (V) => (p(), g("article", {
            key: V.guidance_id,
            "data-guidance-id": V.guidance_id,
            "data-guidance-state": V.state
          }, [
            o("span", {
              class: se(["oxc-guidance-queue__state", `is-${V.state}`])
            }, u(C(V.state)), 3),
            o("details", null, [
              o("summary", null, u(V.text), 1),
              o("p", null, u(V.text), 1),
              V.state === "consumed" ? (p(), g("small", py, u(e.isZh ? "执行端已在检查点接收，不代表模型已经采用。" : "Received by execution at a checkpoint; model adoption is not confirmed."), 1)) : x("", !0)
            ]),
            o("div", hy, [
              V.state === "pending" ? (p(), g(ye, { key: 0 }, [
                o("button", {
                  type: "button",
                  "data-guidance-action": "edit",
                  disabled: !!c.value || V.mutationPending,
                  "aria-label": e.isZh ? "编辑引导" : "Edit guidance",
                  onClick: (ie) => A(V)
                }, [...I[5] || (I[5] = [
                  o("i", {
                    class: "fa-solid fa-pen",
                    "aria-hidden": "true"
                  }, null, -1)
                ])], 8, gy),
                o("button", {
                  type: "button",
                  "data-guidance-action": "cancel",
                  disabled: !!c.value || V.mutationPending,
                  "aria-label": e.isZh ? "撤回引导" : "Withdraw guidance",
                  onClick: (ie) => E(V, "cancel")
                }, [...I[6] || (I[6] = [
                  o("i", {
                    class: "fa-solid fa-xmark",
                    "aria-hidden": "true"
                  }, null, -1)
                ])], 8, my)
              ], 64)) : V.state === "lost" ? (p(), g("button", {
                key: 1,
                type: "button",
                "data-guidance-action": "restore",
                onClick: (ie) => i("restore-text", V.text)
              }, u(e.isZh ? "放回草稿" : "Copy to draft"), 9, yy)) : x("", !0)
            ])
          ], 8, vy))), 128))
        ])) : x("", !0),
        (e.state.items?.length || 0) > 3 ? (p(), g("button", {
          key: 3,
          type: "button",
          class: "oxc-guidance-queue__more",
          onClick: I[0] || (I[0] = (V) => s.value = !s.value)
        }, u(s.value ? e.isZh ? "收起记录" : "Show fewer" : e.isZh ? `查看全部 ${e.state.items.length} 条` : `View all ${e.state.items.length}`), 1)) : x("", !0),
        a.value ? (p(), g("div", by, [
          o("label", {
            for: `guidance-edit-${a.value.guidance_id}`
          }, u(e.isZh ? "编辑待接收引导" : "Edit pending guidance"), 9, _y),
          o("textarea", {
            id: `guidance-edit-${a.value.guidance_id}`,
            value: r.value,
            maxlength: "16000",
            disabled: !!c.value,
            "aria-label": e.isZh ? "编辑引导内容" : "Edit guidance text",
            onInput: I[1] || (I[1] = (V) => r.value = V.target.value),
            onKeydown: I[2] || (I[2] = Re(() => {
            }, ["stop"]))
          }, null, 40, wy),
          o("div", null, [
            o("button", {
              type: "button",
              "data-guidance-action": "dismiss-edit",
              disabled: !!c.value,
              onClick: R
            }, u(e.isZh ? "取消编辑" : "Cancel edit"), 9, ky),
            o("button", {
              type: "button",
              "data-guidance-action": "save-edit",
              disabled: !!c.value || !r.value.trim(),
              onClick: I[3] || (I[3] = (V) => E(a.value, "edit"))
            }, u(c.value ? e.isZh ? "正在确认" : "Confirming" : e.isZh ? "保存引导" : "Save guidance"), 9, xy)
          ])
        ])) : x("", !0),
        f.value || e.state.error ? (p(), g("p", Sy, u(f.value || e.state.error), 1)) : x("", !0),
        e.state.notice ? (p(), g("p", Cy, u(e.state.notice), 1)) : x("", !0)
      ], 8, ay)) : x("", !0);
    }
  }, Iy = /* @__PURE__ */ In(Ay, [["__scopeId", "data-v-a2e2838a"]]), $y = ["data-connection-state", "data-connection-request", "aria-busy", "aria-label"], My = {
    class: "oxc-connection-notice__heading",
    role: "status",
    "aria-live": "polite"
  }, Ty = { class: "oxc-connection-notice__description" }, Py = {
    key: 0,
    class: "oxc-connection-notice__reason"
  }, Ey = {
    key: 1,
    class: "oxc-connection-notice__error",
    role: "alert"
  }, Ry = { class: "oxc-connection-notice__footer" }, Ny = {
    key: 0,
    class: "oxc-connection-notice__details"
  }, Ly = {
    key: 0,
    class: "oxc-connection-notice__http"
  }, Oy = { key: 1 }, Dy = { class: "oxc-connection-notice__actions" }, Fy = ["disabled"], qy = ["disabled"], jy = {
    __name: "ConnectionNotice",
    props: { state: { type: Object, required: !0 }, isZh: { type: Boolean, default: !0 }, busy: Boolean, continuing: Boolean, actionError: { type: String, default: "" } },
    emits: ["check", "continue"],
    setup(e, { emit: t }) {
      const n = e, i = t, s = J(() => {
        const f = n.state, m = n.isZh;
        if (f.state === "checking") {
          const h = Number.isInteger(f.attempt) && Number.isInteger(f.maxAttempts) && f.attempt > 0 && f.attempt <= f.maxAttempts && f.maxAttempts <= 5 ? ` ${f.attempt}/${f.maxAttempts}` : "";
          return (m ? "正在检查会话状态" : "Checking conversation state") + h;
        }
        return f.state === "offline" ? m ? "设备网络已离线" : "Device is offline" : f.state === "reachable" ? m ? "应用服务可达" : "Application service is reachable" : f.state === "failed" ? m ? "会话状态检查未成功" : "Conversation state check failed" : f.httpStatus === 401 || f.httpStatus === 403 || f.kind === "auth" ? m ? "服务认证未通过" : "Service authentication failed" : f.httpStatus === 429 ? m ? "请求暂时受到限制" : "Requests are temporarily limited" : f.kind === "quota" ? m ? "当前服务额度不足" : "Service quota is insufficient" : [502, 503, 504].includes(f.httpStatus) ? m ? "服务暂时不可用" : "Service is temporarily unavailable" : f.kind === "timeout" ? m ? "等待响应超时" : "The response timed out" : m ? "连接中断，当前进度已保留" : "Connection interrupted; progress is retained";
      }), a = J(() => n.state.state === "checking" ? n.isZh ? "正在核对原执行状态，已有内容会保留。" : "Checking the original execution state; existing content is retained." : n.state.message ? n.state.message : n.state.state === "reachable" ? n.isZh ? "状态检查已收到响应，原回复尚未继续。" : "The state check received a response. The original reply has not continued." : n.state.state === "offline" ? n.isZh ? "连接网络后可以检查会话状态。" : "Check the conversation state after connecting to a network." : n.isZh ? "已有内容会保留，可检查会话状态后再继续。" : "Existing content is retained. Check the conversation state before continuing."), r = J(() => Number.isInteger(n.state.httpStatus) && new RegExp(`\\bHTTP\\s+${n.state.httpStatus}\\b`, "i").test(String(n.state.detail || "")));
      function c(f) {
        n.busy || n.continuing || n.state.state === "checking" || (f === "check" ? !n.state.canCheck : !n.state.canContinue) || i(f, { conversationId: n.state.conversationId, requestId: n.state.requestId, workspacePath: n.state.workspacePath });
      }
      return (f, m) => (p(), g("section", {
        class: se(["oxc-connection-notice", `is-${e.state.state}`]),
        "data-connection-state": e.state.state,
        "data-connection-request": e.state.requestId,
        "aria-busy": e.busy || e.continuing || e.state.state === "checking",
        "aria-label": e.isZh ? "会话连接状态" : "Conversation connection state"
      }, [
        o("div", My, [
          o("i", {
            class: se(e.state.state === "checking" ? "fa-solid fa-spinner fa-spin" : e.state.state === "reachable" ? "fa-solid fa-circle-check" : "fa-solid fa-link-slash"),
            "aria-hidden": "true"
          }, null, 2),
          o("strong", null, u(s.value), 1)
        ]),
        o("p", Ty, u(a.value), 1),
        e.state.continueReason ? (p(), g("p", Py, u(e.state.continueReason), 1)) : x("", !0),
        e.actionError ? (p(), g("p", Ey, u(e.actionError), 1)) : x("", !0),
        o("div", Ry, [
          e.state.detail || e.state.httpStatus ? (p(), g("details", Ny, [
            o("summary", null, u(e.isZh ? "查看详情" : "View details"), 1),
            e.state.httpStatus && !r.value ? (p(), g("p", Ly, "HTTP " + u(e.state.httpStatus), 1)) : x("", !0),
            e.state.detail ? (p(), g("p", Oy, u(e.state.detail), 1)) : x("", !0)
          ])) : x("", !0),
          o("div", Dy, [
            e.state.canCheck || e.busy ? (p(), g("button", {
              key: 0,
              type: "button",
              "data-connection-action": "check",
              disabled: e.busy || e.continuing || e.state.state === "checking",
              onClick: m[0] || (m[0] = (h) => c("check"))
            }, u(e.busy ? e.isZh ? "正在检查" : "Checking" : e.state.state === "failed" ? e.isZh ? "重新检查" : "Check again" : e.isZh ? "检查会话状态" : "Check conversation state"), 9, Fy)) : x("", !0),
            e.state.canContinue || e.continuing ? (p(), g("button", {
              key: 1,
              type: "button",
              class: "is-primary",
              "data-connection-action": "continue",
              disabled: e.busy || e.continuing || e.state.state === "checking",
              onClick: m[1] || (m[1] = (h) => c("continue"))
            }, u(e.continuing ? e.isZh ? "正在核对" : "Verifying" : e.isZh ? "继续会话" : "Continue conversation"), 9, qy)) : x("", !0)
          ])
        ])
      ], 10, $y));
    }
  }, kr = /* @__PURE__ */ In(jy, [["__scopeId", "data-v-293c6b72"]]), Zy = ["aria-label"], Hy = ["aria-expanded", "aria-label", "title"], By = {
    key: 0,
    class: "oxc-turn-nav__ticks"
  }, Vy = ["data-turn-id", "aria-current", "aria-label", "aria-describedby", "onPointerenter", "onFocus", "onBlur", "onClick"], Uy = { class: "oxc-turn-nav__heading" }, Wy = { class: "oxc-turn-nav__summaries" }, Ky = ["data-turn-id", "aria-current", "onClick"], zy = { class: "oxc-turn-nav__number" }, Gy = { class: "oxc-turn-nav__preview-heading" }, Qy = { class: "oxc-turn-nav__question" }, Jy = { class: "oxc-turn-nav__reply-label" }, Xy = {
    __name: "MessageNavigator",
    props: { messages: { type: Array, default: () => [] }, activeId: { type: String, default: "" }, isZh: { type: Boolean, default: !0 } },
    emits: ["navigate"],
    setup(e, { emit: t }) {
      const n = e, i = t, s = /* @__PURE__ */ G(!1), a = /* @__PURE__ */ G(null), r = /* @__PURE__ */ G(null), c = /* @__PURE__ */ G(null), f = /* @__PURE__ */ G(""), m = /* @__PURE__ */ G(""), h = /* @__PURE__ */ G(0), w = /* @__PURE__ */ G(320);
      let C = null;
      const A = `message-navigation-${No()}`, R = `${A}-preview`, P = J(() => globalThis.OpenXnetConversationModel.buildMessageNavigation(n.messages, { isZh: n.isZh })), E = J(() => s.value ? null : P.value.find((b) => b.id === (f.value || m.value)));
      vt(() => {
        const b = n.messages[0] || {};
        return JSON.stringify([P.value[0]?.id, b.conversationId || b.conversation_id || b.scope?.conversationId, b.workspaceId || b.workspace_id || b.scope?.workspaceId, b.projectId || b.project_id || b.scope?.projectId]);
      }, () => {
        s.value = !1, I();
      }), vt(() => [n.activeId, P.value.length, s.value], Z, { flush: "post" }), Un(() => {
        Z(), globalThis.addEventListener?.("resize", I);
      }), vn(() => {
        clearTimeout(C), globalThis.removeEventListener?.("resize", I);
      });
      function Z() {
        const b = r.value?.querySelector?.(".oxc-turn-nav__ticks");
        if (!b) return;
        const T = [...b.querySelectorAll("button[data-turn-id]")].find((le) => le.getAttribute("data-turn-id") === n.activeId);
        if (!T) return;
        const S = b.getBoundingClientRect(), K = T.getBoundingClientRect();
        K.top < S.top ? b.scrollTop += K.top - S.top : K.bottom > S.bottom && (b.scrollTop += K.bottom - S.bottom);
      }
      function I() {
        clearTimeout(C), f.value = "", m.value = "";
      }
      function V() {
        clearTimeout(C), C = setTimeout(() => {
          f.value = "";
        }, 100);
      }
      function ie() {
        clearTimeout(C);
      }
      async function he(b, T, S = !1) {
        ie(), S ? m.value = b : f.value = b;
        const K = T?.currentTarget?.getBoundingClientRect?.();
        if (await nt(), E.value?.id !== b) return;
        const le = r.value?.getBoundingClientRect?.();
        if (!le) return;
        const F = r.value?.parentElement?.getBoundingClientRect?.(), ae = Math.min(F?.right ?? 1 / 0, globalThis.innerWidth || 1 / 0);
        w.value = Number.isFinite(ae) ? Math.max(80, Math.min(320, ae - le.left - 50)) : 320;
        const Y = c.value?.getBoundingClientRect?.()?.height || 240, ge = K ? K.top - le.top + K.height / 2 : 0;
        h.value = Math.max(0, Math.min(Math.max(0, le.height - Y), ge - Y / 2));
      }
      function Se(b) {
        m.value === b && (m.value = "");
      }
      function de() {
        I(), s.value = !s.value;
      }
      function ve(b) {
        b.inert = !0, b.setAttribute?.("aria-hidden", "true");
      }
      function oe(b) {
        b.inert = !1, b.removeAttribute?.("aria-hidden");
      }
      function me(b) {
        I(), s.value = !1, i("navigate", b);
      }
      function _e(b) {
        if (b.key === "Escape") {
          s.value = !1, I(), a.value?.focus(), b.stopPropagation(), b.preventDefault();
          return;
        }
        if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(b.key)) return;
        const T = [...b.currentTarget.querySelectorAll("button[data-turn-id]")].filter((le) => !le.closest?.("[inert]"));
        if (!T.length) return;
        const S = T.indexOf(b.target);
        let K = b.key === "Home" ? 0 : b.key === "End" ? T.length - 1 : S + (b.key === "ArrowDown" ? 1 : -1);
        K = Math.max(0, Math.min(T.length - 1, K)), T[K].focus(), b.preventDefault();
      }
      return (b, T) => P.value.length ? (p(), g("nav", {
        key: 0,
        ref_key: "navRef",
        ref: r,
        class: "oxc-turn-nav",
        "aria-label": e.isZh ? "消息定位" : "Message navigation",
        onKeydown: _e,
        onPointerenter: ie,
        onPointerleave: V
      }, [
        o("button", {
          ref_key: "toggleRef",
          ref: a,
          class: "oxc-turn-nav__toggle",
          type: "button",
          "aria-expanded": s.value,
          "aria-controls": A,
          "aria-label": e.isZh ? s.value ? "收起消息目录" : "打开消息目录" : s.value ? "Close conversation outline" : "Open conversation outline",
          title: e.isZh ? "消息定位" : "Message navigation",
          onClick: de
        }, [
          o("i", {
            class: se(s.value ? "fa-solid fa-xmark" : "fa-solid fa-list-ul"),
            "aria-hidden": "true"
          }, null, 2)
        ], 8, Hy),
        s.value ? x("", !0) : (p(), g("ol", By, [
          (p(!0), g(ye, null, Te(P.value, (S) => (p(), g("li", {
            key: S.id
          }, [
            o("button", {
              type: "button",
              "data-turn-id": S.id,
              class: se(["oxc-turn-nav__tick", { "is-current": S.id === e.activeId }]),
              "aria-current": S.id === e.activeId ? "location" : void 0,
              "aria-label": `${S.ordinal}. ${S.summary}`,
              "aria-describedby": E.value?.id === S.id ? R : void 0,
              onPointerenter: (K) => he(S.id, K),
              onFocus: (K) => he(S.id, K, !0),
              onBlur: (K) => Se(S.id),
              onClick: (K) => me(S.id)
            }, [...T[0] || (T[0] = [
              o("span", { "aria-hidden": "true" }, null, -1)
            ])], 42, Vy)
          ]))), 128))
        ])),
        Ke(It, {
          name: "oxc-turn-overlay",
          onBeforeEnter: oe,
          onBeforeLeave: ve
        }, {
          default: wt(() => [
            s.value ? (p(), g("div", {
              key: 0,
              id: A,
              class: "oxc-turn-nav__panel"
            }, [
              o("div", Uy, [
                o("strong", null, u(e.isZh ? "对话目录" : "Conversation outline"), 1),
                o("span", null, u(P.value.length), 1)
              ]),
              o("ol", Wy, [
                (p(!0), g(ye, null, Te(P.value, (S) => (p(), g("li", {
                  key: S.id
                }, [
                  o("button", {
                    type: "button",
                    "data-turn-id": S.id,
                    class: se({ "is-current": S.id === e.activeId }),
                    "aria-current": S.id === e.activeId ? "location" : void 0,
                    onClick: (K) => me(S.id)
                  }, [
                    o("span", zy, u(S.ordinal), 1),
                    o("span", null, u(S.summary), 1)
                  ], 10, Ky)
                ]))), 128))
              ])
            ])) : x("", !0)
          ]),
          _: 1
        }),
        Ke(It, {
          name: "oxc-turn-overlay",
          onBeforeEnter: oe,
          onBeforeLeave: ve
        }, {
          default: wt(() => [
            E.value ? (p(), g("aside", {
              key: 0,
              id: R,
              ref_key: "previewRef",
              ref: c,
              class: "oxc-turn-nav__preview",
              role: "tooltip",
              style: un({ top: `${h.value}px`, width: `${w.value}px` }),
              onPointerenter: ie
            }, [
              o("div", Gy, [
                o("span", null, u(e.isZh ? "对话" : "Turn") + " " + u(E.value.ordinal), 1),
                o("span", null, u(E.value.ordinal) + " / " + u(P.value.length), 1)
              ]),
              o("p", Qy, u(E.value.summary), 1),
              o("div", Jy, u(e.isZh ? "回复预览" : "Reply preview"), 1),
              o("p", {
                class: se(["oxc-turn-nav__reply", { "is-empty": !E.value.replyPreview }])
              }, u(E.value.replyPreview || (e.isZh ? "暂无可预览的回复" : "No reply to preview yet")), 3)
            ], 36)) : x("", !0)
          ]),
          _: 1
        })
      ], 40, Zy)) : x("", !0);
    }
  }, Yy = /* @__PURE__ */ In(Xy, [["__scopeId", "data-v-541e85ba"]]);
  function xr(e, t = 72) {
    return e ? Math.max(0, e.scrollHeight - e.scrollTop - e.clientHeight) <= t : !0;
  }
  function eb({ nearBottom: e, explicit: t = !1, scopeChanged: n = !1 }) {
    return !!(t || n || e);
  }
  function gt(e = {}) {
    return JSON.stringify([
      String(e.settings?.workspace?.path || ""),
      String(e.conversationId || "new")
    ]);
  }
  function tb(e, t, n) {
    return Math.max(0, n + t.top - e.top - 24);
  }
  const nb = ["aria-label"], ib = ["title"], sb = {
    key: 2,
    class: "oxc-conversations"
  }, ob = { class: "oxc-conversations__header" }, ab = { class: "oxc-conversations__title" }, rb = { class: "oxc-conversations__header-actions" }, lb = ["title"], cb = ["title"], ub = { class: "oxc-conversations__tabs" }, db = {
    key: 0,
    class: "oxc-conversations__search"
  }, fb = ["value", "placeholder"], vb = {
    key: 1,
    class: "oxc-conversations__list"
  }, pb = {
    key: 0,
    class: "oxc-conversations__empty"
  }, hb = ["onClick", "onContextmenu"], gb = { class: "oxc-conversation-item__head" }, mb = ["title"], yb = ["title", "onClick"], bb = ["title"], _b = {
    key: 1,
    class: "oxc-conversation-item__meta"
  }, wb = { key: 0 }, kb = { key: 1 }, xb = {
    key: 2,
    class: "oxc-conversation-item__time"
  }, Sb = {
    key: 2,
    class: "oxc-workspace"
  }, Cb = {
    key: 0,
    class: "oxc-conversations__empty"
  }, Ab = ["onClick"], Ib = { class: "oxc-workspace-project__copy" }, $b = { class: "oxc-workspace-project__body" }, Mb = ["onClick", "onContextmenu"], Tb = { class: "oxc-conversation-item__head" }, Pb = ["title"], Eb = ["onClick"], Rb = ["title"], Nb = ["aria-label"], Lb = ["disabled"], Ob = ["disabled"], Db = ["disabled"], Fb = { id: "oxc-rename-title" }, qb = { for: "oxc-rename-input" }, jb = ["disabled"], Zb = {
    key: 0,
    class: "oxc-rename-dialog__error",
    role: "alert"
  }, Hb = { class: "oxc-rename-dialog__actions" }, Bb = ["disabled"], Vb = ["disabled"], Ub = { class: "oxc-chat-column" }, Wb = { class: "oxc-header" }, Kb = { class: "oxc-header__left" }, zb = ["aria-label", "aria-expanded"], Gb = { class: "oxc-header__title" }, Qb = { class: "oxc-header__right" }, Jb = ["title"], Xb = ["title"], Yb = ["title"], e_ = {
    key: 0,
    class: "oxc-quest-panel"
  }, t_ = { class: "oxc-quest-panel__head" }, n_ = { class: "oxc-quest-panel__title" }, i_ = { class: "oxc-quest-panel__body" }, s_ = { class: "oxc-quest-card" }, o_ = { class: "oxc-quest-url" }, a_ = ["title"], r_ = ["title"], l_ = { class: "oxc-quest-grid" }, c_ = { class: "oxc-quest-metric" }, u_ = { class: "oxc-quest-metric" }, d_ = { class: "oxc-quest-metric" }, f_ = { class: "oxc-quest-metric" }, v_ = { class: "oxc-quest-card" }, p_ = { class: "oxc-quest-hardware-list" }, h_ = { class: "oxc-quest-empty" }, g_ = { class: "oxc-quest-card" }, m_ = {
    key: 0,
    class: "oxc-quest-lan-list"
  }, y_ = ["onClick"], b_ = {
    key: 1,
    class: "oxc-quest-empty"
  }, __ = { class: "oxc-quest-panel__actions" }, w_ = ["disabled"], k_ = ["title"], x_ = { class: "oxc-stream__inner" }, S_ = {
    key: 0,
    class: "oxc-project-welcome"
  }, C_ = { class: "oxc-project-welcome__inner" }, A_ = { class: "oxc-project-welcome__title" }, I_ = { class: "oxc-project-welcome__path" }, $_ = {
    key: 1,
    class: "oxc-empty"
  }, M_ = { class: "oxc-welcome-identity" }, T_ = ["src", "alt"], P_ = {
    key: 1,
    src: "source/icon.png",
    alt: "OpenXnet"
  }, E_ = { class: "oxc-welcome-eyebrow" }, R_ = { class: "oxc-welcome-actions" }, N_ = ["data-message-id"], L_ = ["aria-label", "onClick"], O_ = ["src", "alt"], D_ = { key: 1 }, F_ = { class: "oxc-msg__content" }, q_ = {
    key: 0,
    class: "oxc-msg__identity-name"
  }, j_ = ["onClick"], Z_ = {
    key: 3,
    class: "oxc-sent-attachments"
  }, H_ = ["src", "alt"], B_ = { key: 1 }, V_ = {
    key: 4,
    class: "oxc-msg__bubble oxc-msg__bubble--ai oxc-msg__bubble--typing"
  }, U_ = {
    key: 5,
    class: "oxc-msg__bubble oxc-msg__bubble--ai markdown-body"
  }, W_ = {
    key: 6,
    class: "oxc-msg__bubble oxc-msg__bubble--user"
  }, K_ = {
    key: 8,
    class: "oxc-message-actions"
  }, z_ = ["aria-label", "title", "onClick"], G_ = ["aria-label", "title", "onClick"], Q_ = ["aria-label", "title", "onClick"], J_ = { key: 2 }, X_ = ["aria-label"], Y_ = ["data-automation-id", "onClick"], e1 = { class: "oxc-automation-card__heading" }, t1 = { class: "oxc-automation-origin" }, n1 = ["title"], i1 = {
    key: 1,
    class: "oxc-automation-result"
  }, s1 = {
    key: 0,
    role: "alert"
  }, o1 = ["aria-busy"], a1 = ["disabled"], r1 = ["disabled"], l1 = {
    key: 0,
    class: "oxc-low-credits-banner"
  }, c1 = { class: "oxc-low-credits-banner__copy" }, u1 = ["title"], d1 = {
    key: 0,
    class: "oxc-file-summary__add"
  }, f1 = {
    key: 1,
    class: "oxc-file-summary__remove"
  }, v1 = { class: "oxc-input-card" }, p1 = {
    key: 0,
    class: "oxc-composer-error",
    role: "alert"
  }, h1 = {
    key: 1,
    class: "oxc-composer-error oxc-permission-error",
    role: "alert"
  }, g1 = {
    key: 2,
    class: "oxc-attachments"
  }, m1 = ["src", "alt"], y1 = ["title"], b1 = ["title", "onClick"], _1 = ["value", "placeholder"], w1 = { class: "oxc-input-toolbar" }, k1 = { class: "oxc-input-toolbar__left" }, x1 = ["title"], S1 = ["title"], C1 = ["title"], A1 = ["src", "alt"], I1 = {
    key: 1,
    class: "fa-regular fa-address-card"
  }, $1 = {
    key: 0,
    class: "oxc-popover oxc-popover--up oxc-popover--role-card"
  }, M1 = { class: "oxc-popover__head" }, T1 = { class: "oxc-popover__option-copy" }, P1 = {
    key: 1,
    class: "oxc-role-card-list"
  }, E1 = ["onClick"], R1 = ["src", "alt"], N1 = { key: 1 }, L1 = { class: "oxc-popover__option-copy" }, O1 = { class: "oxc-role-card-tag" }, D1 = {
    key: 2,
    class: "oxc-role-card-empty"
  }, F1 = ["disabled"], q1 = ["title"], j1 = ["title"], Z1 = ["aria-expanded", "title"], H1 = {
    key: 0,
    class: "oxc-popover oxc-popover--up oxc-memory-controls"
  }, B1 = { class: "oxc-popover__head" }, V1 = { class: "oxc-popover__option-copy" }, U1 = ["disabled"], W1 = { class: "oxc-popover__option-copy" }, K1 = { class: "oxc-memory-controls__note" }, z1 = ["title"], G1 = ["aria-expanded"], Q1 = { class: "oxc-popover-wrap" }, J1 = ["title"], X1 = { class: "oxc-popover-item__label" }, Y1 = { class: "oxc-popover-item__label" }, ew = { class: "oxc-popover-item__label" }, tw = { class: "oxc-popover-item__label" }, nw = { class: "oxc-popover-item__label" }, iw = { class: "oxc-input-toolbar__right" }, sw = ["title", "aria-label", "aria-expanded", "aria-busy"], ow = { class: "oxc-chip__label" }, aw = {
    key: 0,
    class: "oxc-permission-unconfirmed"
  }, rw = ["aria-label"], lw = { class: "oxc-popover__head" }, cw = {
    key: 0,
    class: "oxc-permission-note"
  }, uw = {
    key: 1,
    class: "oxc-permission-note",
    role: "status"
  }, dw = ["data-permission-mode", "aria-pressed", "disabled", "onClick"], fw = { class: "oxc-popover__option-copy" }, vw = {
    key: 0,
    class: "fa-solid fa-check oxc-popover__option-check"
  }, pw = ["title"], hw = { class: "oxc-chip__label" }, gw = { class: "oxc-popover oxc-popover--up oxc-popover--credits" }, mw = { class: "oxc-popover__head" }, yw = ["title", "disabled"], bw = { class: "oxc-credits-grid" }, _w = { class: "oxc-credits-item" }, ww = { class: "oxc-credits-item" }, kw = { class: "oxc-credits-item" }, xw = { class: "oxc-credits-item" }, Sw = ["title", "aria-label"], Cw = {
    viewBox: "0 0 24 24",
    class: "oxc-context-ring__svg"
  }, Aw = ["stroke-dasharray", "stroke-dashoffset"], Iw = { class: "oxc-context-ring__pct" }, $w = { class: "oxc-popover oxc-popover--up oxc-popover--context" }, Mw = { class: "oxc-popover__head" }, Tw = {
    key: 0,
    class: "oxc-context-bar"
  }, Pw = { class: "oxc-context-note" }, Ew = { class: "oxc-context-rows" }, Rw = ["title", "aria-label"], Nw = ["title", "aria-label", "disabled"], Lw = { class: "oxc-context-strip oxc-context-strip--below" }, Ow = { class: "oxc-composer-hint" }, Dw = ["disabled", "title"], Fw = {
    key: 0,
    class: "oxc-git-dirty"
  }, qw = {
    key: 1,
    class: "fa-solid fa-chevron-down oxc-context-chip__caret"
  }, jw = { class: "oxc-popover oxc-popover--up oxc-popover--git" }, Zw = { class: "oxc-popover__head" }, Hw = { key: 0 }, Bw = ["disabled", "onClick"], Vw = { class: "oxc-popover__option-copy" }, Uw = {
    key: 0,
    class: "fa-solid fa-check oxc-popover__option-check"
  }, Ww = ["title"], Kw = { class: "oxc-settings-panel__header" }, zw = { class: "oxc-settings-panel__title" }, Gw = ["title"], Qw = { class: "oxc-settings-panel__body" }, Jw = { class: "oxc-setting-group" }, Xw = { class: "oxc-setting-group__label" }, Yw = { class: "oxc-model-summary" }, ek = { class: "oxc-model-summary__provider" }, tk = ["src", "alt"], nk = {
    key: 1,
    class: "oxc-model-summary__fallback"
  }, ik = { class: "oxc-model-summary__copy" }, sk = { class: "oxc-model-summary__meta-row" }, ok = { class: "oxc-model-summary__model" }, ak = ["disabled"], rk = { class: "oxc-model-button__name" }, lk = {
    key: 0,
    class: "oxc-provider-picker"
  }, ck = { class: "oxc-provider-picker__head" }, uk = { class: "oxc-provider-grid" }, dk = ["onClick"], fk = { class: "oxc-provider-card__head" }, vk = { class: "oxc-provider-card__brand" }, pk = ["src", "alt"], hk = {
    key: 1,
    class: "oxc-provider-card__fallback"
  }, gk = { class: "oxc-provider-card__title" }, mk = {
    key: 0,
    class: "oxc-provider-card__active"
  }, yk = {
    key: 1,
    class: "oxc-provider-card__template"
  }, bk = { class: "oxc-provider-card__model" }, _k = { class: "oxc-provider-card__summary" }, wk = {
    key: 0,
    class: "oxc-provider-card__validation"
  }, kk = {
    key: 0,
    class: "oxc-provider-diagnostics"
  }, xk = { class: "oxc-provider-picker__head" }, Sk = {
    key: 0,
    class: "oxc-provider-diagnostics__message"
  }, Ck = {
    key: 1,
    class: "oxc-provider-models__chips"
  }, Ak = ["onClick"], Ik = {
    key: 1,
    class: "oxc-provider-models"
  }, $k = {
    key: 0,
    class: "oxc-provider-diagnostics"
  }, Mk = { class: "oxc-provider-picker__head" }, Tk = { class: "oxc-provider-diagnostics__chips" }, Pk = {
    key: 0,
    class: "oxc-provider-diagnostics__message"
  }, Ek = {
    key: 1,
    class: "oxc-provider-checks"
  }, Rk = {
    key: 2,
    class: "oxc-provider-models__chips"
  }, Nk = ["onClick"], Lk = { class: "oxc-provider-picker__head" }, Ok = { class: "oxc-provider-models__chips" }, Dk = ["onClick"], Fk = { class: "oxc-setting-group__hint" }, qk = { class: "oxc-setting-group" }, jk = { class: "oxc-setting-group__label" }, Zk = { class: "oxc-slider-row" }, Hk = ["value"], Bk = { class: "oxc-slider-value" }, Vk = { class: "oxc-setting-group__hint" }, Uk = { class: "oxc-setting-group" }, Wk = { class: "oxc-setting-group__label" }, Kk = ["value"], zk = ["value"], Gk = { class: "oxc-setting-group" }, Qk = { class: "oxc-setting-group__label" }, Jk = ["value", "placeholder"], Xk = {
    key: 0,
    class: "oxc-setting-group"
  }, Yk = { class: "oxc-toggle-row" }, ex = { class: "oxc-setting-group__label" }, tx = { class: "oxc-toggle" }, nx = ["aria-label", "checked", "disabled"], ix = { class: "oxc-setting-group__hint" }, sx = { class: "oxc-toggle-row" }, ox = { class: "oxc-setting-group__label" }, ax = { class: "oxc-toggle" }, rx = ["aria-label", "checked", "disabled"], lx = {
    key: 0,
    class: "oxc-composer-error",
    role: "alert"
  }, cx = {
    key: 1,
    class: "oxc-setting-group"
  }, ux = { class: "oxc-toggle-row" }, dx = { class: "oxc-setting-group__label" }, fx = { class: "oxc-toggle" }, vx = ["checked"], px = { class: "oxc-setting-group__hint" }, hx = {
    key: 2,
    class: "oxc-setting-group"
  }, gx = { class: "oxc-toggle-row" }, mx = { class: "oxc-setting-group__label" }, yx = { class: "oxc-toggle" }, bx = ["checked"], _x = { class: "oxc-setting-group__hint" }, wx = { class: "oxc-setting-group" }, kx = { class: "oxc-toggle-row" }, xx = { class: "oxc-setting-group__label" }, Sx = { class: "oxc-toggle" }, Cx = ["checked"], Ax = { class: "oxc-setting-group__hint" }, Sr = 48, Cr = 168, Ix = 60, $x = 240, Mx = 680, Tx = {
    __name: "App",
    setup(e) {
      const t = Fp(), n = /* @__PURE__ */ G(t.snapshot()), i = /* @__PURE__ */ G(""), s = /* @__PURE__ */ G(""), a = J(() => s.value === gt(n.value)), r = J(() => n.value.guidance || { items: [], available: !1, loading: !1, sending: !1, error: "", notice: "" }), c = /* @__PURE__ */ G(null), f = /* @__PURE__ */ G(null), m = /* @__PURE__ */ G(null), h = /* @__PURE__ */ G(160), w = /* @__PURE__ */ G(!1), C = /* @__PURE__ */ G(!1), A = /* @__PURE__ */ G(!1), R = /* @__PURE__ */ G(!1), P = /* @__PURE__ */ G(!1), E = /* @__PURE__ */ G(null), Z = /* @__PURE__ */ G(typeof window > "u" ? 1280 : window.innerWidth), I = /* @__PURE__ */ G(Z.value >= 1e3), V = /* @__PURE__ */ G(!1), ie = /* @__PURE__ */ G(!1), he = /* @__PURE__ */ G(""), Se = /* @__PURE__ */ G(""), de = /* @__PURE__ */ G(!1), ve = /* @__PURE__ */ G(!1), oe = /* @__PURE__ */ G(null), me = /* @__PURE__ */ G([]), _e = /* @__PURE__ */ G(""), b = /* @__PURE__ */ G(""), T = /* @__PURE__ */ G(!1), S = /* @__PURE__ */ G(""), K = /* @__PURE__ */ G(!1), le = /* @__PURE__ */ G(""), F = J(() => n.value.recovery || { available: !1, pending: !1, error: "", reason: "" }), ae = /* @__PURE__ */ G(""), Y = /* @__PURE__ */ G(""), ge = J(() => {
        const d = n.value.connection;
        return !d || !["offline", "interrupted", "checking", "reachable", "failed"].includes(d.state) || d.conversationId !== n.value.conversationId || String(d.workspacePath || "") !== String(n.value.settings?.workspace?.path || "") ? null : d;
      });
      function xe(d) {
        return JSON.stringify([d?.conversationId || "", d?.requestId || "", d?.workspacePath || ""]);
      }
      const z = J(() => ge.value ? xe(ge.value) : ""), N = J(() => !!z.value && ae.value === z.value), $ = J(() => ge.value?.messageId && n.value.messages?.some((d) => d.role === "assistant" && d.id === ge.value.messageId) ? ge.value.messageId : ""), U = J(() => !!ge.value?.requestId && ge.value.requestId === F.value.requestId && ge.value.conversationId === F.value.conversationId);
      vt(z, () => {
        Y.value = "";
      });
      const ne = J(() => n.value.automations || { tasks: [], error: "", loading: !1 }), Ze = J(() => ne.value.tasks.find((d) => d.id === b.value) || null), H = /* @__PURE__ */ G(null), B = /* @__PURE__ */ G(!1), j = /* @__PURE__ */ G(""), ce = /* @__PURE__ */ G(!1), y = /* @__PURE__ */ G(""), k = /* @__PURE__ */ G(null), M = /* @__PURE__ */ G(""), D = /* @__PURE__ */ new Map();
      let q = gt(n.value);
      const L = J(() => (n.value.messages || []).find((d) => d.id === oe.value?.messageId) || null), ee = /* @__PURE__ */ G({
        visible: !1,
        tone: "info",
        text: ""
      });
      let X = null, Q = "", W = "", ue = "", re = null, fe = null, pe = 0, $e = 0, Pe = 0;
      const Me = {
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
      }, Je = J(() => `${h.value}px`);
      function Ge(d = null) {
        for (const l of [ie, C, A, R, ht, Et, Ct, Rn])
          l !== d && (l.value = !1);
      }
      function Xe(d, l) {
        l?.stopPropagation?.();
        const v = !d.value;
        Ge(d), v && tn(), d.value = v;
      }
      function yt(d) {
        Xe(ie, d);
      }
      function Vt() {
        ie.value = !1, C.value && (C.value = !1), A.value && (A.value = !1), R.value && (R.value = !1), ht.value && (ht.value = !1), Et.value && (Et.value = !1), Ct.value && (Ct.value = !1), Rn.value && (Rn.value = !1), et.value.visible && (et.value = { visible: !1, x: 0, y: 0, conversationId: "", conversationTitle: "" });
      }
      function Wn(d) {
        if (d.key !== "Escape") return;
        tn(), V.value = !1;
        const l = et.value.visible ? Es : null;
        Vt(), l?.focus({ preventScroll: !0 });
      }
      function it() {
        const d = Z.value >= 1e3;
        Z.value = window.innerWidth, d && Z.value < 1e3 && (I.value = !1), bs(), Xn();
      }
      function Ee(d, l = "info") {
        ee.value = {
          visible: !0,
          tone: l,
          text: d
        }, re && window.clearTimeout(re), re = window.setTimeout(() => {
          ee.value.visible = !1;
        }, 2800);
      }
      function Mi(d) {
        return d.map((l) => [
          l.id,
          l.role,
          l.time,
          l.typing ? "typing" : "content",
          l.text || "",
          l.html || "",
          l.activity?.signature || "",
          JSON.stringify(l.identity || null),
          JSON.stringify(l.memoryContext || []),
          JSON.stringify(l.attachments || [])
        ].join("::")).join("||");
      }
      function Ti(d) {
        return (d || []).map((l) => [
          l.id,
          l.title,
          l.preview,
          l.time,
          l.providerName,
          l.model,
          l.isActive ? "1" : "0"
        ].join(":")).join("|");
      }
      function Jl(d) {
        if (!d) return "";
        const l = (d.projects || []).map((O) => `${O.id}:${O.isActive ? "1" : "0"}:${O.lastUsed || ""}`).join("|"), v = d.git || {};
        return [
          d.loaded ? "1" : "0",
          d.path || "",
          d.name || "",
          l,
          v.enabled ? "1" : "0",
          v.branch || "",
          v.dirty ? "1" : "0",
          v.ahead || 0,
          v.behind || 0
        ].join("::");
      }
      function Xl(d) {
        const l = d || {}, v = l.permission || {}, O = l.contextWindow || {}, ke = l.customCredits || {};
        return [
          l.providerId,
          l.providerName,
          l.model,
          l.temperature,
          l.maxTokens,
          l.memoryEnabled ? "1" : "0",
          l.nativeMemoryEnabled ? "1" : "0",
          l.interpreterEnabled ? "1" : "0",
          l.asrEnabled ? "1" : "0",
          l.webSearchEnabled ? "1" : "0",
          l.browserControlEnabled ? "1" : "0",
          l.ttsEnabled ? "1" : "0",
          l.desktopVisionEnabled ? "1" : "0",
          l.roleCardEnabled ? "1" : "0",
          l.roleCardSelectedId,
          l.roleCardAvatarImage,
          l.roleCardAvatarText,
          l.roleCardName,
          l.systemPrompt,
          l.completionNotificationsEnabled,
          l.completionNotificationSound,
          l.completionPreferencesAvailable,
          l.memoryAvailable,
          l.nativeMemoryAvailable,
          JSON.stringify(l.roleCards || []),
          JSON.stringify(l.providerCards || []),
          JSON.stringify(l.validation || null),
          v.current,
          v.available,
          v.pending,
          v.engine,
          v.scopeHint,
          v.uncertain,
          JSON.stringify(v.options || []),
          O.percent,
          O.label,
          O.summary,
          O.used,
          O.limit,
          ke.active ? "1" : "0",
          ke.dailyRemaining,
          ke.totalRemaining,
          ke.planName,
          Jl(l.workspace)
        ].join("::");
      }
      function Yl(d, l) {
        return [
          l,
          d.isZh ? "zh" : "en",
          d.activeMenu || "",
          d.conversationId || "",
          d.title || "",
          d.model || "",
          d.modelDisplay || "",
          d.isEmpty ? "1" : "0",
          d.isSending ? "1" : "0",
          d.historyQuery || "",
          JSON.stringify(d.automations || null),
          JSON.stringify(d.recovery || null),
          JSON.stringify(d.guidance || null),
          JSON.stringify(d.connection || null),
          Ti(d.conversations || []),
          Xl(d.settings || {}),
          (d.attachments || []).map((v) => `${v.name || ""}:${v.path || ""}`).join("|")
        ].join("||");
      }
      function Pi(d) {
        return typeof window < "u" && typeof window.requestAnimationFrame == "function" ? window.requestAnimationFrame(d) : (d(), 0);
      }
      function bt(d) {
        d && typeof window < "u" && typeof window.cancelAnimationFrame == "function" && window.cancelAnimationFrame(d);
      }
      function ec() {
        return typeof window > "u" ? null : typeof window.morphdom == "function" ? window.morphdom : null;
      }
      function zo(d, l) {
        const v = String(l || "");
        v !== d.__oxcStableHtml && (d.__oxcStableHtml = v, d.__oxcStableHtmlFrame && bt(d.__oxcStableHtmlFrame), d.__oxcStableHtmlFrame = Pi(() => {
          if (d.__oxcStableHtmlFrame = 0, v === d.__oxcStableHtmlRendered) return;
          const O = ec();
          if (O && typeof document < "u") {
            const ke = document.createElement("div");
            ke.innerHTML = v, O(d, ke, {
              childrenOnly: !0,
              onBeforeElUpdated(je, Ne) {
                return !(je.isEqualNode(Ne) || je.matches?.("pre, code, table") && je.textContent === Ne.textContent);
              }
            });
          } else
            d.innerHTML = v;
          d.__oxcStableHtmlRendered = v;
        }));
      }
      const tc = {
        mounted(d, l) {
          d.__oxcStableHtml = "", d.__oxcStableHtmlRendered = "", zo(d, l.value);
        },
        updated(d, l) {
          zo(d, l.value);
        },
        beforeUnmount(d) {
          d.__oxcStableHtmlFrame && bt(d.__oxcStableHtmlFrame);
        }
      };
      function ys() {
        const d = f.value, l = d ? Math.ceil(d.getBoundingClientRect().height) : 132, v = Math.max(132, l + 28);
        return Math.abs(h.value - v) > 1 && (h.value = v), v;
      }
      function Kn() {
        return !ve.value && xr(c.value);
      }
      function Go() {
        const d = c.value;
        d && (d.scrollTop = Math.max(0, d.scrollHeight - d.clientHeight + 2));
      }
      function Ei(d = !1, l = 2) {
        if (!c.value || !d && !Kn()) return;
        const v = Pe;
        bt(pe), bt($e), pe = Pi(() => {
          pe = 0, v === Pe && (!d && !Kn() || (Go(), l > 1 && ($e = Pi(() => {
            $e = 0, v === Pe && (d || Kn()) && Go();
          }))));
        });
      }
      function bs() {
        const d = Kn();
        nt(() => {
          Pi(() => {
            ys(), d && !ve.value && Ei(!0, 2);
          });
        });
      }
      function _s(d = n.value) {
        return d?.activeMenu === "chat" && d?.isSending ? Ix : d?.activeMenu === "chat" ? $x : Mx;
      }
      function Qo(d = _s()) {
        X && window.clearTimeout(X), X = window.setTimeout(() => {
          const l = Ae(!1, { passive: !0 });
          Ni(), ra(), Qo(_s(l || n.value));
        }, d);
      }
      function Ae(d = !1, l = {}) {
        const v = !!l?.passive, O = Kn(), ke = t.snapshot(), je = gt(ke), Ne = je !== q;
        Ne && (D.set(q, i.value), i.value = D.get(je) || "", q = je, oe.value = null, me.value = [], _e.value = "", b.value = "", S.value = "", he.value = "", Se.value = "", ve.value = !1, de.value = !1, j.value = "", M.value = "");
        const rt = Mi(ke.messages), gn = Yl(ke, rt), Ls = gn !== W, Aa = ke.activeMenu === "chat" && ue !== "chat", Ia = eb({ nearBottom: O, explicit: d || Aa, scopeChanged: Ne }), Cu = Pe;
        return (!v || Ls || d || Aa) && (rt !== Q && !Ia && (de.value = !0), n.value = ke, Q = rt, W = gn, nt(() => {
          ys(), Ia && Cu === Pe && (ve.value = !1, Ei(!0, 2)), Ne && pn();
        })), ue = ke.activeMenu || "", ke;
      }
      function pn() {
        const d = m.value;
        if (!d) return;
        d.style.height = "auto";
        const l = Math.min(
          Math.max(d.scrollHeight, Sr),
          Cr
        );
        d.style.height = `${l}px`, d.style.overflowY = d.scrollHeight > Cr ? "auto" : "hidden", bs();
      }
      function nc(d) {
        i.value = d.target.value, D.set(q, i.value), j.value = "", nt(pn);
      }
      function ic() {
        const d = c.value;
        if (!d) return;
        if (Se.value) {
          he.value = Se.value, ve.value = !0;
          return;
        }
        const l = xr(d);
        l || (Pe += 1), ve.value = !l, l ? de.value = !1 : (bt(pe), bt($e));
        const v = d.getBoundingClientRect().top + 96, O = Array.from(d.querySelectorAll("[data-message-id]")), je = (O.filter((rt) => rt.getBoundingClientRect().top <= v).at(-1) || O[0])?.dataset.messageId || "", Ne = n.value.messages.findIndex((rt) => rt.id === je);
        he.value = n.value.messages.slice(0, Ne + 1).findLast((rt) => rt.role === "user")?.id || "";
      }
      function Ri(d) {
        d?.type === "keydown" && (!["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "].includes(d.key) || ["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(d.target?.tagName) || d.target?.isContentEditable) || (Se.value = "", Pe += 1, ve.value = !0, bt(pe), bt($e));
      }
      function sc(d) {
        d.target === c.value && Ri(d);
      }
      function oc(d) {
        const l = c.value, v = Array.from(l?.querySelectorAll("[data-message-id]") || []).find((O) => O.dataset.messageId === String(d));
        !l || !v || (Pe += 1, bt(pe), bt($e), Se.value = String(d), l.scrollTop = tb(l.getBoundingClientRect(), v.getBoundingClientRect(), l.scrollTop), ve.value = !0, he.value = String(d), v.focus({ preventScroll: !0 }));
      }
      function Jo() {
        Pe += 1, Se.value = "", he.value = n.value.messages.findLast((d) => d.role === "user")?.id || "", ve.value = !1, de.value = !1, Ei(!0, 2);
      }
      function zn(d, l = { kind: "identity" }) {
        if (Tn.value.some((v) => v.id === d)) {
          if (b.value = "", l.kind === "file") {
            const v = na(d, l);
            if (!v) return;
            const O = me.value.findIndex((ke) => ke.key === v.key);
            O >= 0 ? me.value[O] = v : me.value.push(v), _e.value = v.key;
          }
          Ge(), oe.value = { ...l, messageId: d }, w.value = !1, Z.value < 1400 && (I.value = !1);
        }
      }
      function tn() {
        b.value = "", oe.value = null, me.value = [], _e.value = "";
      }
      function ac(d, l) {
        return t.readSubagentTranscript(d, l);
      }
      function Ni(d = !1) {
        t.refreshAutomations?.({ open: !!b.value, force: d }).then((l) => {
          l && Ae(!1, { passive: !0 });
        }).catch(() => {
        });
      }
      function rc(d) {
        ne.value.tasks.some((l) => l.id === d) && (tn(), Ge(), b.value = d, w.value = !1, Z.value < 1400 && (I.value = !1), Ni());
      }
      function lc() {
        Ae(!1, { passive: !0 });
      }
      function cc(d) {
        return { active: _.value ? "进行中" : "Active", paused: _.value ? "已暂停" : "Paused", completed: _.value ? "已结束" : "Completed" }[d] || (_.value ? "状态未知" : "Unknown");
      }
      function Xo(d) {
        return [...d.runs || []].reverse().find((l) => l.notify && l.summary) || null;
      }
      function uc(d) {
        const l = new Date(d);
        return Number.isNaN(l.getTime()) ? String(d || "") : l.toLocaleString(_.value ? "zh-CN" : "en-US");
      }
      async function ws(d = !1) {
        if (T.value || F.value.pending || n.value.isSending) return;
        const l = gt(n.value), v = { conversationId: n.value.conversationId, requestId: F.value.requestId || "", workspacePath: He.value.path || "" };
        T.value = !0, S.value = "";
        try {
          const O = await (d ? t.retryConversationSave() : t.resumeConversationRecovery(v));
          if (l !== gt(n.value) || !d && v.requestId !== F.value.requestId) return;
          Ae(!1, { passive: !0 }), O !== !0 && !F.value.error && !F.value.reason && (S.value = _.value ? "尚未获得确认，请重试。" : "Not yet confirmed. Please retry.");
        } catch {
          l === gt(n.value) && (d || v.requestId === F.value.requestId) && (S.value = _.value ? "恢复失败，请检查会话状态后重试。" : "Recovery failed. Check the conversation state and retry.");
        } finally {
          T.value = !1, l === gt(n.value) && Ae(!1, { passive: !0 });
        }
      }
      async function Yo(d) {
        const l = xe(d);
        if (!(l !== z.value || N.value || T.value || !ge.value?.canCheck || typeof t.checkConversationConnection != "function")) {
          ae.value = l, Y.value = "";
          try {
            const v = await t.checkConversationConnection(d);
            Ae(!1, { passive: !0 }), l === z.value && v === !1 && (Y.value = _.value ? "状态检查尚未确认，请重试。" : "The state check was not confirmed. Please retry.");
          } catch {
            l === z.value && (Y.value = _.value ? "状态检查未完成，请稍后重试。" : "The state check did not complete. Please retry.");
          } finally {
            ae.value === l && (ae.value = ""), l === z.value && Ae(!1, { passive: !0 });
          }
        }
      }
      async function ea(d) {
        xe(d) !== z.value || N.value || !ge.value?.canContinue || !U.value || !F.value.available || await ws(!1);
      }
      async function ta(d, l) {
        const v = l?.target?.checked === !0;
        if (l?.target && (l.target.checked = te.value[d] === !0), !(K.value || !te.value.completionPreferencesAvailable)) {
          K.value = !0, le.value = "";
          try {
            if (await t.setCompletionPreference(d, v) !== !0) throw new Error(_.value ? "完成提醒设置没有保存成功。" : "Completion preference saving was not confirmed.");
          } catch (O) {
            le.value = O?.message || (_.value ? "保存失败，请重试。" : "Saving failed. Please retry.");
          } finally {
            K.value = !1, Ae(!1, { passive: !0 });
          }
        }
      }
      function na(d, l) {
        const O = Tn.value.find((Ne) => Ne.id === d)?.activity?.steps?.find((Ne) => Ne.id === l.stepId), ke = O?.fileChanges?.find((Ne) => (!l.fileId || Ne.id === l.fileId) && (!l.path || Ne.path === l.path));
        if (!ke || !l.fileId && !l.path) return null;
        const je = gt(n.value);
        return { key: JSON.stringify([je, ke.path]), scope: je, conversationId: n.value.conversationId, workspacePath: He.value.path || "", messageId: d, stepId: O.id, fileId: ke.id, path: ke.path, file: ke };
      }
      const ia = J(() => me.value.map((d) => na(d.messageId, d) || { ...d, file: null })), sa = J(() => {
        const d = Tn.value, l = d.findLastIndex((O) => O.role === "user"), v = [];
        for (const O of d.slice(l < 0 ? 0 : l + 1))
          if (O.role === "assistant")
            for (const ke of O.activity?.steps || [])
              for (const je of ke.fileChanges || []) je.confirmed && v.push({ messageId: O.id, stepId: ke.id, fileId: je.id, path: je.path, file: je });
        return v;
      }), hn = J(() => {
        const d = sa.value, l = (v) => d.length && d.every((O) => Number.isInteger(O.file[v]) && O.file[v] >= 0) ? d.reduce((O, ke) => O + ke.file[v], 0) : null;
        return { count: new Set(d.map((v) => v.path)).size, additions: l("additions"), deletions: l("deletions") };
      });
      function dc() {
        for (const d of sa.value) zn(d.messageId, { kind: "file", stepId: d.stepId, fileId: d.fileId, path: d.path });
      }
      function oa(d) {
        const l = me.value.find((v) => v.key === d);
        l && (_e.value = d, oe.value = { kind: "file", messageId: l.messageId, stepId: l.stepId, fileId: l.fileId, path: l.path });
      }
      function fc(d) {
        const l = me.value.findIndex((v) => v.key === d);
        if (!(l < 0)) {
          if (me.value.splice(l, 1), !me.value.length) {
            tn();
            return;
          }
          _e.value === d && oa(me.value[Math.min(l, me.value.length - 1)].key);
        }
      }
      function $n(d) {
        return { id: "", name: d.role === "assistant" ? "OpenXnet" : _.value ? "你" : "You", image: "", text: d.role === "assistant" ? "OX" : _.value ? "我" : "ME", ...d.identity };
      }
      async function vc(d) {
        try {
          await navigator.clipboard.writeText(String(d.text || "")), Ee(_.value ? "已复制消息" : "Message copied", "success");
        } catch {
          Ee(_.value ? "复制失败，请选择正文手动复制。" : "Copy failed. Select the text to copy it manually.", "warning");
        }
      }
      function pc(d) {
        const l = String(d.text || "").slice(0, 6e3).split(`
`).map((v) => `> ${v}`).join(`
`);
        i.value = `${i.value ? `${i.value}

` : ""}${l}

`, D.set(q, i.value), nt(() => {
          pn(), m.value?.focus();
        });
      }
      function hc(d) {
        i.value = d, D.set(q, d), nt(() => {
          pn(), m.value?.focus();
        });
      }
      async function gc(d) {
        const l = d.target.files?.[0];
        if (d.target.value = "", !(!l || B.value)) {
          B.value = !0;
          try {
            if (typeof t.importRoleAvatar != "function") throw new Error(_.value ? "头像导入暂不可用。" : "Avatar import is unavailable.");
            await t.importRoleAvatar(l), Ae(), Ee(_.value ? "角色头像已保存，将用于后续消息。" : "Role portrait saved for subsequent messages.", "success");
          } catch (v) {
            Ee(v?.message || (_.value ? "头像导入失败" : "Avatar import failed"), "warning");
          } finally {
            B.value = !1;
          }
        }
      }
      function mc(d) {
        t.handlePaste(d), nt(Ae);
      }
      function yc(d) {
        t.removeAttachment(d), Ae();
      }
      function ks() {
        I.value = !I.value;
      }
      async function aa() {
        const d = String(i.value || "");
        if (a.value || r.value.sending || (ce.value || Oe.value.pending) && !(n.value.isSending && !d.trim() && !sn.value.length)) return;
        const l = q;
        if (!d.trim() && !sn.value.length) return;
        const v = n.value.isSending;
        if (v && sn.value.length) {
          j.value = _.value ? "当前引导支持文字，请先移除附件。" : "Live guidance supports text; remove attachments first.";
          return;
        }
        v && (s.value = l), j.value = "", (d.trim() || sn.value.length) && Jo(), i.value = "", D.set(l, ""), nt(() => {
          m.value && (m.value.style.height = `${Sr}px`, m.value.style.overflowY = "hidden");
        });
        try {
          const O = await t.sendMessage(d);
          if (O === !1 || O?.accepted === !1) throw new Error(v ? t.snapshot().guidance?.error || (_.value ? "引导未发送，草稿已保留。" : "Guidance was not sent; your draft was kept.") : _.value ? "消息未发送，请检查模型与附件后重试。" : "Message not sent. Check the model and attachments, then retry.");
        } catch (O) {
          q === l ? (i.value ? v && i.value !== d && (i.value = `${d}

${i.value}`) : i.value = d, D.set(l, i.value), j.value = O?.message || (_.value ? "发送失败，草稿已保留。" : "Sending failed. Your draft is preserved.")) : D.get(l) || D.set(l, d);
        } finally {
          v && s.value === l && (s.value = "");
        }
        Ae(), nt(pn);
      }
      function bc() {
        t.stopResponse?.(), Ae(!1, { passive: !0 });
      }
      function ra() {
        t.refreshGuidance?.().then((d) => {
          d && Ae(!1, { passive: !0 });
        }).catch(() => {
        });
      }
      function _c(d) {
        i.value = [i.value, d].filter(Boolean).join(`

`), D.set(q, i.value), nt(pn);
      }
      function wc(d) {
        d.key === "Enter" && !d.shiftKey && !d.isComposing && d.keyCode !== 229 && (d.preventDefault(), aa());
      }
      async function xs() {
        await t.startNewChat(), Ae(!0);
      }
      function kc() {
        t.openHistory();
      }
      function la() {
        Ge(), tn(), w.value = !w.value;
      }
      function ca() {
        w.value = !1;
      }
      function xc() {
        Ge(), tn(), w.value = !0;
      }
      function Ss(d) {
        const l = d && typeof d == "object" ? d : {}, v = l.status && typeof l.status == "object" ? l.status : l, O = v.gateway && typeof v.gateway == "object" ? v.gateway : {}, ke = v.network && typeof v.network == "object" ? v.network : {}, je = v.desktop && typeof v.desktop == "object" ? v.desktop : {}, Ne = v.device && typeof v.device == "object" ? v.device : {}, rt = v.local && typeof v.local == "object" ? v.local : {}, gn = v.lan && typeof v.lan == "object" ? v.lan : {}, Ls = Array.isArray(ke.lan_urls) ? ke.lan_urls : Array.isArray(gn.interfaces) ? gn.interfaces : [];
        return {
          ...Me,
          ...v,
          gateway: {
            ...Me.gateway,
            ...O,
            status: l.success === !0 || v.success === !0 || gn.available ? "ready" : O.status || Me.gateway.status,
            protocol_version: O.protocol_version || "vr-gateway/v1",
            recommended_quest_url: O.recommended_quest_url || gn.recommended_quest_url || rt.quest_url || Me.gateway.recommended_quest_url,
            local_quest_url: O.local_quest_url || rt.quest_url || Me.gateway.local_quest_url
          },
          network: {
            ...Me.network,
            ...ke,
            lan_urls: Ls
          },
          desktop: {
            ...Me.desktop,
            ...je
          },
          device: {
            ...Me.device,
            ...Ne,
            device: {
              ...Me.device.device,
              ...Ne.device && typeof Ne.device == "object" ? Ne.device : {}
            },
            capabilities: {
              ...Me.device.capabilities,
              ...Ne.capabilities && typeof Ne.capabilities == "object" ? Ne.capabilities : {}
            },
            hardware: {
              ...Me.device.hardware,
              ...Ne.hardware && typeof Ne.hardware == "object" ? Ne.hardware : {}
            },
            runtime: {
              ...Me.device.runtime,
              ...Ne.runtime && typeof Ne.runtime == "object" ? Ne.runtime : {}
            }
          }
        };
      }
      async function ua({ silent: d = !1 } = {}) {
        if (P.value) return E.value;
        P.value = !0;
        try {
          const l = await fetch("/v1/vr/status", { headers: { accept: "application/json" } });
          if (!l.ok) throw new Error(`HTTP ${l.status}`);
          E.value = Ss(await l.json()), d || Ee(_.value ? "Quest 3 连接状态已刷新" : "Quest 3 status refreshed", "success");
        } catch (l) {
          console.warn("[chat-vite] refresh Quest status failed:", l), E.value = Ss({
            gateway: {
              status: "offline",
              recommended_quest_url: "/quest3/",
              local_quest_url: "/quest3/"
            },
            network: {
              lan_urls: []
            }
          }), d || Ee(_.value ? "暂时无法读取 Quest Gateway 状态" : "Quest Gateway status unavailable", "warning");
        } finally {
          P.value = !1;
        }
        return E.value;
      }
      function Sc(d) {
        Xe(R, d), R.value && (C.value = !1, A.value = !1, ht.value = !1, Et.value = !1, Ct.value = !1, ua({ silent: !0 }));
      }
      async function da(d) {
        const l = String(d || Qn.value || "").trim();
        if (!l) {
          Ee(_.value ? "没有可复制的 Quest 地址" : "No Quest URL to copy", "warning");
          return;
        }
        try {
          await navigator.clipboard.writeText(l), Ee(_.value ? "Quest 访问地址已复制" : "Quest URL copied", "success");
        } catch (v) {
          console.warn("[chat-vite] copy Quest URL failed:", v), Ee(l, "info");
        }
      }
      function Cc() {
        const d = Qn.value || "/quest3/";
        typeof window < "u" && window.open(d, "_blank", "noopener,noreferrer");
      }
      function Ac() {
        t.openModelPicker();
      }
      function Ic(d) {
        d && t.selectChatProvider(d.id).then(() => Ae()).catch((l) => {
          console.error(l);
        });
      }
      function Cs(d, l) {
        t.selectChatProviderModel(d, l).then(() => Ae()).catch((v) => {
          console.error(v);
        });
      }
      function $c(d) {
        t.validateChatProvider(d).then(() => Ae()).catch((l) => {
          console.error(l);
        });
      }
      function fa() {
        t.browseAllFiles();
      }
      function Mc() {
        t.browseImages();
      }
      function va() {
        t.toggleInterpreter(), Ae();
      }
      function Tc() {
        t.toggleAsr(), Ae();
      }
      function pa() {
        t.toggleMemory(), Ae();
      }
      async function ha() {
        try {
          if (typeof t.toggleNativeMemory != "function") throw new Error(_.value ? "原生记忆设置暂不可用。" : "Native memory settings are unavailable.");
          await t.toggleNativeMemory(), Ae();
        } catch (d) {
          Ee(d?.message || (_.value ? "设置未保存" : "Setting was not saved"), "warning");
        }
      }
      const Mn = /* @__PURE__ */ G("chat");
      async function ga(d) {
        await t.loadConversation(d), Ae(!0);
      }
      function Pc(d) {
        t.setHistoryQuery(d.target.value), Ae();
      }
      async function Ec() {
        const d = await t.addProject();
        Ae(!!d);
      }
      function Rc() {
        t.toggleWebSearch(), Ae();
      }
      function Nc() {
        t.toggleBrowserControl(), Ae();
      }
      function Lc() {
        t.toggleTts(), Ae();
      }
      function Oc() {
        t.toggleDesktopVision(), Ae();
      }
      function Dc() {
        t.triggerScreenshot(), C.value = !1;
      }
      function Fc() {
        t.openTablePet(), C.value = !1, A.value = !1;
      }
      function qc(d) {
        Xe(A, d), A.value && (C.value = !1, R.value = !1, ht.value = !1, Et.value = !1, Ct.value = !1);
      }
      async function jc(d) {
        d?.id && (await t.selectRoleCard(d.id), A.value = !1, Ae());
      }
      async function Zc() {
        await t.disableRoleCard(), A.value = !1, Ae();
      }
      function ma() {
        t.openRoleCardPanel(), A.value = !1;
      }
      function Hc(d) {
        Xe(C, d), C.value && (A.value = !1, R.value = !1);
      }
      function Bc(d) {
        t.setTemperature(d.target.value), Ae();
      }
      function Vc(d) {
        t.setMaxTokens(d.target.value), Ae();
      }
      function Uc(d) {
        t.setSystemPrompt(d.target.value), Ae();
      }
      const Tn = J(() => n.value.messages || []), Wc = J(() => n.value.isSending ? n.value.isZh ? "补充要求，引导当前回复…" : "Add instructions for this reply…" : n.value.isZh ? "输入消息..." : "Type a message..."), Kc = J(() => n.value.isSending && !String(i.value || "").trim() ? "fa-solid fa-stop" : "fa-solid fa-arrow-up"), te = J(() => n.value.settings || {}), Li = J(() => te.value.providerCards || []), we = J(() => {
        const d = String(te.value.providerId || "").trim();
        return Li.value.find((l) => String(l?.id || "") === d) || Li.value[0] || null;
      }), ya = J(() => te.value.roleCards || []), zc = J(() => {
        const d = String(te.value.roleCardName || "").trim();
        return te.value.roleCardEnabled && d ? _.value ? `当前角色卡：${d}` : `Current role card: ${d}` : _.value ? "角色卡" : "Role card";
      }), Pn = J(() => {
        const d = !!te.value.roleCardEnabled, l = String(te.value.roleCardName || "").trim(), v = d ? String(te.value.roleCardAvatarImage || "").trim() : "", O = d ? Array.from(l.replace(/\s+/g, "")).slice(0, 2).join("") : "AI", ke = d ? String(te.value.roleCardAvatarText || "").trim() || O || (_.value ? "角" : "R") : "AI", je = d ? String(te.value.roleCardAvatarBackground || "").trim() : "";
        return {
          image: v,
          text: ke,
          alt: d ? l || (_.value ? "角色卡" : "Role card") : "AI",
          roleCard: d,
          style: je ? { background: je } : {}
        };
      }), He = J(() => te.value.workspace || { loaded: !1, name: "", path: "" }), Oe = J(() => {
        const d = te.value.permission || { current: "default", options: [], available: !1 }, l = k.value, v = l?.scope === gt(n.value) && l?.engine === String(d.engine || "");
        return ce.value && v ? { ...d, current: y.value } : d;
      }), at = J(() => te.value.contextWindow || { used: null, limit: null, ratio: 0, percent: null, warn: !1, critical: !1, label: "—", summary: "" }), St = J(() => te.value.customCredits || { active: !1 }), ht = /* @__PURE__ */ G(!1), Et = /* @__PURE__ */ G(!1), Ct = /* @__PURE__ */ G(!1), Oi = /* @__PURE__ */ G(!1), Gc = /* @__PURE__ */ G(1), As = J(() => {
        const d = St.value;
        if (!d.active) return 1;
        const l = Number(d.dailyQuota || 0), v = Number(d.dailyRemaining || 0);
        return l <= 0 ? 1 : Math.max(0, Math.min(1, v / l));
      }), Qc = J(() => !St.value.active || Oi.value ? !1 : As.value <= 0.1), Jc = J(() => {
        const d = St.value, l = Number(d.dailyRemaining || 0), v = Number(d.dailyQuota || 0), O = Math.round(As.value * 100);
        return n.value.isZh ? `今日剩余 ${l}/${v} 积分（${O}%），用完前请先充值或切换其它服务商。` : `${l}/${v} daily credits left (${O}%). Top up or switch provider before they run out.`;
      });
      vt(As, (d, l) => {
        d > 0.2 && Oi.value && (Oi.value = !1), Gc.value = d;
      });
      function Xc() {
        Oi.value = !0;
      }
      function Yc(d) {
        Xe(ht, d), ht.value && (Et.value = !1, Ct.value = !1, A.value = !1, R.value = !1);
      }
      async function eu(d) {
        const l = (Oe.value.options || []).find((O) => O.id === d);
        if (ce.value || Oe.value.pending || Oe.value.available === !1 || l?.disabled || !l) return;
        if (d === Oe.value.current && !Oe.value.uncertain) {
          ht.value = !1;
          return;
        }
        y.value = Oe.value.current;
        const v = { scope: gt(n.value), engine: String(Oe.value.engine || "") };
        k.value = v, ce.value = !0, M.value = "";
        try {
          if (await t.setPermissionMode(d) !== !0) throw new Error(_.value ? "权限模式未保存，请重试。" : "Permission mode was not saved. Please retry.");
          ht.value = !1;
        } catch (O) {
          v.scope === gt(n.value) && v.engine === String(te.value.permission?.engine || "") && (M.value = O?.message || (_.value ? "权限模式保存失败，原模式已保留。" : "Permission saving failed. The previous mode is retained."));
        } finally {
          ce.value = !1, k.value = null, Ae(!1, { passive: !0 });
        }
      }
      function Is(d) {
        const l = (Oe.value.options || []).find((v) => v.id === d);
        return l ? l.label : d === "default" ? _.value ? "默认只读模式" : "Default read-only mode" : d;
      }
      function tu(d) {
        const l = (Oe.value.options || []).find((v) => v.id === d);
        return l ? l.icon : "fa-solid fa-shield-halved";
      }
      function nu(d) {
        Xe(Et, d), Et.value && (ht.value = !1, Ct.value = !1, A.value = !1, R.value = !1);
      }
      const Gn = /* @__PURE__ */ G(!1);
      async function ba() {
        if (!Gn.value) {
          Gn.value = !0;
          try {
            typeof t.refreshCredits == "function" && await t.refreshCredits();
          } finally {
            Gn.value = !1, Ae();
          }
        }
      }
      function iu(d) {
        Xe(Ct, d), Ct.value && (ht.value = !1, Et.value = !1, A.value = !1, R.value = !1, ba());
      }
      function _a() {
        t.openSubscriptionCenter(), Ct.value = !1;
      }
      const wa = J(() => {
        const l = 2 * Math.PI * 9, v = Math.max(0, Math.min(1, at.value.ratio || 0));
        return { circumference: l, offset: l * (1 - v) };
      }), En = J(() => Ss(E.value)), Qn = J(() => {
        const d = En.value.gateway || {};
        return String(d.recommended_quest_url || d.local_quest_url || "/quest3/").trim();
      }), ka = J(() => En.value.network?.lan_urls || []), xa = J(() => String(En.value.gateway?.status || "").toLowerCase() === "ready"), nn = J(() => En.value.device || Me.device), Sa = J(() => nn.value.connected === !0), $s = J(() => P.value ? "checking" : Sa.value ? "ready" : xa.value ? "checking" : "offline"), su = J(() => P.value ? _.value ? "检测中" : "Checking" : Sa.value ? _.value ? "Quest 已连接" : "Quest connected" : xa.value ? _.value ? "等待 Quest 心跳" : "Awaiting Quest" : _.value ? "待启动" : "Pending"), ou = J(() => {
        const d = String(nn.value.name || nn.value.runtime?.device_name || "").trim(), l = String(nn.value.model || nn.value.runtime?.device_model || "").trim();
        if (d || l) return [d, l].filter(Boolean).join(" / ");
        const v = String(En.value.desktop?.connected_device || "").trim();
        return !v || v === "unknown" ? _.value ? "Quest 设备待授权" : "Quest device pending" : v;
      }), au = J(() => {
        const d = Number(nn.value.age_seconds);
        return Number.isFinite(d) ? d <= 2 ? _.value ? "刚刚" : "Just now" : d < 60 ? _.value ? `${d} 秒前` : `${d}s ago` : _.value ? `${Math.floor(d / 60)} 分钟前` : `${Math.floor(d / 60)}m ago` : _.value ? "暂无心跳" : "No heartbeat";
      }), ru = J(() => {
        const d = nn.value.runtime || {};
        return String(d.xr_loaded_device || d.xr_loader || d.platform || "Unity XR").trim();
      });
      function lu(d) {
        if (!d || typeof d != "object") return "unknown";
        if (d.available === !0) return "ready";
        const l = String(d.status || "").toLowerCase();
        return l.includes("required") || l.includes("planned") || l.includes("sdk") ? "planned" : l.includes("not_exposed") || l.includes("not_detected") ? "offline" : "unknown";
      }
      function cu(d) {
        if (!d || typeof d != "object") return _.value ? "未知" : "Unknown";
        const l = String(d.status || "").trim();
        return d.available === !0 ? _.value ? "可用" : "Available" : l === "not_exposed" ? _.value ? "不开放" : "Not exposed" : l === "not_detected" ? _.value ? "未检测" : "Not detected" : l.includes("requires") ? _.value ? "需 SDK/权限" : "SDK/permission" : l.includes("permission_required") ? _.value ? "需授权" : "Permission" : l || (_.value ? "待确认" : "Pending");
      }
      const uu = J(() => {
        const d = nn.value.hardware || {};
        return [
          { key: "headset_tracking", icon: "fa-solid fa-location-crosshairs", zh: "头显 6DoF", en: "Headset 6DoF" },
          { key: "controllers", icon: "fa-solid fa-gamepad", zh: "手柄", en: "Controllers" },
          { key: "hand_tracking", icon: "fa-regular fa-hand", zh: "手部追踪", en: "Hand tracking" },
          { key: "passthrough_camera", icon: "fa-solid fa-camera", zh: "透视摄像头", en: "Passthrough" },
          { key: "depth_api", icon: "fa-solid fa-layer-group", zh: "Depth API", en: "Depth API" },
          { key: "scene_mesh", icon: "fa-solid fa-border-all", zh: "房间网格", en: "Scene mesh" },
          { key: "microphone", icon: "fa-solid fa-microphone", zh: "麦克风", en: "Microphone" },
          { key: "raw_lidar_or_radar", icon: "fa-solid fa-ban", zh: "原始雷达/LiDAR", en: "Raw LiDAR/Radar" }
        ].map((l) => {
          const v = d[l.key] || {};
          return {
            ...l,
            capability: v,
            tone: lu(v),
            text: cu(v)
          };
        });
      }), Jn = /* @__PURE__ */ G(/* @__PURE__ */ new Set()), Rn = /* @__PURE__ */ G(!1), Nn = /* @__PURE__ */ G(!1), Di = /* @__PURE__ */ G(!1), At = /* @__PURE__ */ G(!1), Fi = /* @__PURE__ */ G(!1), pt = /* @__PURE__ */ G({ visible: !1, id: "", title: "", originalTitle: "", error: "" }), Ms = /* @__PURE__ */ G(null), Ts = /* @__PURE__ */ G(null), et = /* @__PURE__ */ G({ visible: !1, x: 0, y: 0, conversationId: "", conversationTitle: "" }), Ps = /* @__PURE__ */ G(null);
      let Es = null;
      function Ca(d) {
        return d ? d.isActive ? !0 : Jn.value.has(d.id) : !1;
      }
      async function du(d) {
        if (!d) return;
        if (!d.isActive) {
          const v = await t.selectProject(d), O = new Set(Jn.value);
          O.add(d.id), Jn.value = O, Ae(!!v);
          return;
        }
        const l = new Set(Jn.value);
        l.has(d.id) ? l.delete(d.id) : l.add(d.id), Jn.value = l;
      }
      function fu(d) {
        return !d || !d.isActive ? [] : Rs.value || [];
      }
      function vu(d) {
        !He.value.git?.canSwitch || Nn.value || Xe(Rn, d);
      }
      async function pu(d) {
        if (!(!He.value.git?.canSwitch || Nn.value)) {
          Nn.value = !0;
          try {
            if (!await t.setGitBranch(d)) {
              Ee(_.value ? "分支未切换，请重试" : "Branch was not switched. Please try again.", "error");
              return;
            }
            Rn.value = !1, Ae(!0);
          } catch {
            Ee(_.value ? "分支切换失败，请重试" : "Could not switch branches. Please try again.", "error");
          } finally {
            Nn.value = !1;
          }
        }
      }
      async function qi(d, l) {
        if (!l) return;
        d && typeof d.preventDefault == "function" && d.preventDefault(), d && typeof d.stopPropagation == "function" && d.stopPropagation(), Es = d?.currentTarget?.closest("button") || null;
        const v = d?.currentTarget?.getBoundingClientRect?.(), O = d?.clientX || v?.right || 8, ke = d?.clientY || v?.bottom || 8, je = Math.max(8, Math.min(O, window.innerWidth - 220)), Ne = Math.max(8, Math.min(ke, window.innerHeight - 200));
        if (et.value = {
          visible: !0,
          x: je,
          y: Ne,
          conversationId: String(l.id || ""),
          conversationTitle: String(l.title || "")
        }, await nt(), !et.value.visible || !Ps.value) return;
        const rt = Ps.value.getBoundingClientRect();
        et.value.x = Math.max(8, Math.min(O, window.innerWidth - rt.width - 8)), et.value.y = Math.max(8, Math.min(ke, window.innerHeight - rt.height - 8));
      }
      function Xn() {
        et.value.visible && (et.value = { visible: !1, x: 0, y: 0, conversationId: "", conversationTitle: "" });
      }
      async function hu() {
        const d = et.value.conversationId, l = et.value.conversationTitle || "";
        !d || At.value || (Xn(), pt.value = { visible: !0, id: d, title: l, originalTitle: l, error: "" }, await nt(), Ms.value?.showModal(), Ts.value?.focus(), Ts.value?.select());
      }
      function Yn() {
        Ms.value?.close(), pt.value = { visible: !1, id: "", title: "", originalTitle: "", error: "" }, Es?.focus({ preventScroll: !0 });
      }
      async function gu() {
        const { id: d, title: l, originalTitle: v } = pt.value, O = String(l || "").trim();
        if (!(!d || !O || At.value)) {
          if (O === v) {
            Yn();
            return;
          }
          At.value = !0, pt.value.error = "";
          try {
            if (!await t.renameConversation(d, O)) {
              pt.value.error = _.value ? "对话未重命名，请重试" : "Conversation was not renamed. Please try again.", Ee(pt.value.error, "error");
              return;
            }
            Yn(), Ee(_.value ? "对话已重命名" : "Conversation renamed", "success"), Ae(!0);
          } catch {
            pt.value.error = _.value ? "名称保存失败，请重试" : "Could not save the name. Please try again.", Ee(pt.value.error, "error");
          } finally {
            At.value = !1;
          }
        }
      }
      async function mu() {
        const d = et.value.conversationId;
        Xn();
        const l = await t.copyConversationId(d);
        Ee(l ? "对话 ID 已复制" : "复制失败", l ? "success" : "warning");
      }
      async function yu() {
        const d = et.value.conversationId;
        if (!(!d || Di.value)) {
          Xn(), Di.value = !0;
          try {
            if (!await t.archiveConversation(d)) {
              Ee(_.value ? "对话未归档，请重试" : "Conversation was not archived. Please try again.", "error");
              return;
            }
            Ee(_.value ? "对话已归档" : "Conversation archived", "success"), Ae(!0);
          } catch {
            Ee(_.value ? "归档保存失败，请重试" : "Could not save the archive. Please try again.", "error");
          } finally {
            Di.value = !1;
          }
        }
      }
      async function bu() {
        const d = et.value.conversationId;
        Xn(), await _u(d);
      }
      async function _u(d) {
        if (!d || Fi.value) return !1;
        Fi.value = !0;
        try {
          return await t.deleteConversation(d) ? (Ae(!0), Ee(_.value ? "对话已删除" : "Conversation deleted", "success"), !0) : (Ee(_.value ? "对话未删除，请重试" : "Conversation was not deleted. Please try again.", "error"), !1);
        } catch {
          return Ee(_.value ? "删除保存失败，请重试" : "Could not save the deletion. Please try again.", "error"), !1;
        } finally {
          Fi.value = !1;
        }
      }
      const wu = J(() => {
        if (!we.value) return "";
        const d = String(we.value.validationStatus || "").trim();
        if (!d) return _.value ? "未验证" : "Not validated";
        const l = { success: "验证通过", warning: "需关注", blocked: "阻塞", error: "异常" }, v = { success: "Validated", warning: "Warning", blocked: "Blocked", error: "Error" };
        return _.value ? l[d] || d : v[d] || d;
      }), Rs = J(() => n.value.conversations || []), ku = J(() => n.value.historyQuery || ""), sn = J(() => n.value.attachments || []), xu = J(() => {
        const d = Tn.value;
        return d.map((l, v) => {
          const O = d[v - 1], ke = l.role === "assistant" && v === d.length - 1 && !!n.value.isSending, je = !!(O && O.role === l.role);
          return { ...l, sameRole: je, streaming: ke };
        });
      }), _ = J(() => n.value.isZh), Su = J(() => Number(te.value.temperature || 0).toFixed(1));
      function Ns(d) {
        return String(d?.validationStatus || "").trim() ? wu.value : _.value ? "未验证" : "Not validated";
      }
      return vt(
        () => [te.value.providerId, te.value.model],
        (d, l) => {
          const v = `${String(d[0] || "")}::${String(d[1] || "")}`, O = `${String(l[0] || "")}::${String(l[1] || "")}`;
          if (O && v !== O) {
            const ke = String(te.value.providerName || "").trim(), je = String(te.value.model || n.value.model || "").trim();
            Ee(
              ke ? `${ke} · ${je}` : je,
              "success"
            );
          }
        }
      ), Un(() => {
        Ae(!0), Ni(), ra(), Qo(_s()), nt(() => {
          pn(), ys(), Ei(!0, 3), typeof window < "u" && typeof window.ResizeObserver == "function" && f.value && (fe = new window.ResizeObserver(bs), fe.observe(f.value));
        }), window.addEventListener("resize", it), document.addEventListener("mousedown", Vt), document.addEventListener("keydown", Wn);
      }), vn(() => {
        t.suspendAutomationRefresh?.(), t.suspendGuidanceRefresh?.(), X && (window.clearTimeout(X), X = null), re && (window.clearTimeout(re), re = null), fe && (fe.disconnect(), fe = null), bt(pe), bt($e), pe = 0, $e = 0, window.removeEventListener("resize", it), document.removeEventListener("mousedown", Vt), document.removeEventListener("keydown", Wn);
      }), (d, l) => (p(), g("div", {
        class: se(["ox-vite-chat-shell", { "has-inspector": !!L.value || !!b.value, "has-conversation-list": I.value }])
      }, [
        o("input", {
          ref_key: "avatarInputRef",
          ref: H,
          type: "file",
          class: "oxc-avatar-file",
          accept: "image/png,image/jpeg,image/webp",
          "aria-label": "导入角色头像 / Import role portrait",
          onChange: gc
        }, null, 544),
        I.value && Z.value < 1e3 ? (p(), g("button", {
          key: 0,
          class: "oxc-conversation-backdrop",
          type: "button",
          "aria-label": _.value ? "收起会话列表" : "Close conversation list",
          onClick: l[0] || (l[0] = (v) => I.value = !1)
        }, null, 8, nb)) : x("", !0),
        I.value ? x("", !0) : (p(), g("button", {
          key: 1,
          type: "button",
          class: "oxc-conversations-handle",
          title: _.value ? "展开会话栏" : "Expand conversations",
          onClick: ks
        }, [...l[40] || (l[40] = [
          o("i", { class: "fa-solid fa-chevron-right" }, null, -1)
        ])], 8, ib)),
        I.value ? (p(), g("aside", sb, [
          o("div", ob, [
            o("span", ab, u(_.value ? "会话" : "Conversations"), 1),
            o("div", rb, [
              o("button", {
                type: "button",
                class: "oxc-conversations__new",
                title: _.value ? "新对话" : "New chat",
                onClick: xs
              }, [...l[41] || (l[41] = [
                o("i", { class: "fa-solid fa-plus" }, null, -1)
              ])], 8, lb),
              o("button", {
                type: "button",
                class: "oxc-conversations__collapse",
                title: _.value ? "收起会话栏" : "Collapse conversations",
                onClick: ks
              }, [...l[42] || (l[42] = [
                o("i", { class: "fa-solid fa-chevron-left" }, null, -1)
              ])], 8, cb)
            ])
          ]),
          o("div", ub, [
            o("button", {
              type: "button",
              class: se(["oxc-conversations__tab", { "is-active": Mn.value === "chat" }]),
              onClick: l[1] || (l[1] = (v) => Mn.value = "chat")
            }, [
              l[43] || (l[43] = o("i", { class: "fa-solid fa-folder" }, null, -1)),
              o("span", null, u(_.value ? "聊天" : "Chat"), 1)
            ], 2),
            o("button", {
              type: "button",
              class: se(["oxc-conversations__tab", { "is-active": Mn.value === "project" }]),
              onClick: l[2] || (l[2] = (v) => Mn.value = "project")
            }, [
              l[44] || (l[44] = o("i", { class: "fa-solid fa-folder-tree" }, null, -1)),
              o("span", null, u(_.value ? "工作区" : "Workspace"), 1)
            ], 2)
          ]),
          Mn.value === "chat" ? (p(), g("div", db, [
            l[45] || (l[45] = o("i", { class: "fa-solid fa-magnifying-glass" }, null, -1)),
            o("input", {
              type: "text",
              value: ku.value,
              placeholder: _.value ? "搜索..." : "Search...",
              onInput: Pc
            }, null, 40, fb)
          ])) : x("", !0),
          Mn.value === "chat" ? (p(), g("div", vb, [
            Rs.value.length === 0 ? (p(), g("div", pb, u(_.value ? "暂时还没有会话记录" : "No conversations yet"), 1)) : (p(!0), g(ye, { key: 1 }, Te(Rs.value, (v) => (p(), g("button", {
              key: v.id,
              type: "button",
              class: se(["oxc-conversation-item", { "is-active": v.isActive }]),
              onClick: (O) => ga(v.id),
              onContextmenu: Re((O) => qi(O, v), ["prevent"])
            }, [
              o("div", gb, [
                o("span", {
                  class: "oxc-conversation-item__title",
                  title: v.title
                }, u(v.title), 9, mb),
                o("span", {
                  class: "oxc-conversation-item__more",
                  title: _.value ? "更多操作" : "More",
                  onClick: Re((O) => qi(O, v), ["stop"])
                }, [...l[46] || (l[46] = [
                  o("i", { class: "fa-solid fa-ellipsis" }, null, -1)
                ])], 8, yb)
              ]),
              v.preview ? (p(), g("div", {
                key: 0,
                class: "oxc-conversation-item__preview",
                title: v.preview
              }, u(v.preview), 9, bb)) : x("", !0),
              v.providerName || v.model ? (p(), g("div", _b, [
                v.providerName ? (p(), g("span", wb, u(v.providerName), 1)) : x("", !0),
                v.model ? (p(), g("span", kb, u(v.model), 1)) : x("", !0)
              ])) : x("", !0),
              v.time ? (p(), g("div", xb, u(v.time), 1)) : x("", !0)
            ], 42, hb))), 128))
          ])) : (p(), g("div", Sb, [
            o("button", {
              type: "button",
              class: "oxc-workspace__add",
              onClick: Ec
            }, [
              l[47] || (l[47] = o("i", { class: "fa-solid fa-plus" }, null, -1)),
              o("span", null, u(_.value ? "添加项目" : "Add Project"), 1)
            ]),
            He.value.projects.length ? x("", !0) : (p(), g("div", Cb, u(_.value ? "暂未连接任何项目，点击上方按钮选择文件夹。" : "No projects connected yet. Click above to pick a folder."), 1)),
            (p(!0), g(ye, null, Te(He.value.projects, (v) => (p(), g("div", {
              key: v.id,
              class: "oxc-workspace-project"
            }, [
              o("button", {
                type: "button",
                class: se(["oxc-workspace-project__head", { "is-active": v.isActive }]),
                onClick: (O) => du(v)
              }, [
                l[48] || (l[48] = o("i", { class: "fa-solid fa-folder-tree oxc-workspace-project__icon" }, null, -1)),
                o("div", Ib, [
                  o("strong", null, u(v.name), 1),
                  o("small", null, u(v.path), 1)
                ]),
                o("i", {
                  class: se(["fa-solid fa-chevron-down oxc-workspace-project__caret", { "is-open": Ca(v) }])
                }, null, 2)
              ], 10, Ab),
              Rt(o("div", $b, [
                (p(!0), g(ye, null, Te(fu(v), (O) => (p(), g("button", {
                  key: `proj-${v.id}-${O.id}`,
                  type: "button",
                  class: se(["oxc-conversation-item oxc-conversation-item--nested", { "is-active": O.isActive }]),
                  onClick: (ke) => ga(O.id),
                  onContextmenu: Re((ke) => qi(ke, O), ["prevent"])
                }, [
                  o("div", Tb, [
                    o("span", {
                      class: "oxc-conversation-item__title",
                      title: O.title
                    }, u(O.title), 9, Pb),
                    o("span", {
                      class: "oxc-conversation-item__more",
                      onClick: Re((ke) => qi(ke, O), ["stop"])
                    }, [...l[49] || (l[49] = [
                      o("i", { class: "fa-solid fa-ellipsis" }, null, -1)
                    ])], 8, Eb)
                  ]),
                  O.preview ? (p(), g("div", {
                    key: 0,
                    class: "oxc-conversation-item__preview",
                    title: O.preview
                  }, u(O.preview), 9, Rb)) : x("", !0)
                ], 42, Mb))), 128)),
                v.isActive ? (p(), g("button", {
                  key: 0,
                  type: "button",
                  class: "oxc-workspace-project__new",
                  onClick: xs
                }, [
                  l[50] || (l[50] = o("i", { class: "fa-solid fa-plus" }, null, -1)),
                  o("span", null, u(_.value ? "新建项目对话" : "New conversation"), 1)
                ])) : x("", !0)
              ], 512), [
                [an, Ca(v)]
              ])
            ]))), 128))
          ]))
        ])) : x("", !0),
        (p(), Lt(La, { to: "body" }, [
          et.value.visible ? (p(), g("div", {
            key: 0,
            ref_key: "conversationMenuRef",
            ref: Ps,
            class: "oxc-conversation-menu",
            role: "group",
            "aria-label": _.value ? "对话操作" : "Conversation actions",
            style: un({ top: et.value.y + "px", left: et.value.x + "px" }),
            onClick: l[3] || (l[3] = Re(() => {
            }, ["stop"])),
            onMousedown: l[4] || (l[4] = Re(() => {
            }, ["stop"]))
          }, [
            o("button", {
              type: "button",
              class: "oxc-conversation-menu__item",
              disabled: At.value,
              onClick: hu
            }, [
              l[51] || (l[51] = o("i", { class: "fa-solid fa-pen-to-square" }, null, -1)),
              o("span", null, u(_.value ? "重命名对话" : "Rename"), 1)
            ], 8, Lb),
            o("button", {
              type: "button",
              class: "oxc-conversation-menu__item",
              onClick: mu
            }, [
              l[52] || (l[52] = o("i", { class: "fa-solid fa-copy" }, null, -1)),
              o("span", null, u(_.value ? "复制对话 ID" : "Copy conversation ID"), 1)
            ]),
            o("button", {
              type: "button",
              class: "oxc-conversation-menu__item",
              disabled: Di.value,
              onClick: yu
            }, [
              l[53] || (l[53] = o("i", { class: "fa-solid fa-box-archive" }, null, -1)),
              o("span", null, u(_.value ? "归档对话" : "Archive conversation"), 1)
            ], 8, Ob),
            l[55] || (l[55] = o("div", { class: "oxc-conversation-menu__divider" }, null, -1)),
            o("button", {
              type: "button",
              class: "oxc-conversation-menu__item is-danger",
              disabled: Fi.value,
              onClick: bu
            }, [
              l[54] || (l[54] = o("i", { class: "fa-regular fa-trash-can" }, null, -1)),
              o("span", null, u(_.value ? "删除对话" : "Delete"), 1)
            ], 8, Db)
          ], 44, Nb)) : x("", !0)
        ])),
        (p(), Lt(La, { to: "body" }, [
          pt.value.visible ? (p(), g("dialog", {
            key: 0,
            ref_key: "renameDialogRef",
            ref: Ms,
            class: "oxc-rename-dialog",
            "aria-labelledby": "oxc-rename-title",
            onCancel: l[6] || (l[6] = Re((v) => !At.value && Yn(), ["prevent"])),
            onClick: l[7] || (l[7] = (v) => v.target === v.currentTarget && !At.value && Yn())
          }, [
            o("form", {
              onSubmit: Re(gu, ["prevent"])
            }, [
              o("h2", Fb, u(_.value ? "重命名对话" : "Rename conversation"), 1),
              o("label", qb, u(_.value ? "对话名称" : "Conversation name"), 1),
              Rt(o("input", {
                id: "oxc-rename-input",
                ref_key: "renameInputRef",
                ref: Ts,
                "onUpdate:modelValue": l[5] || (l[5] = (v) => pt.value.title = v),
                required: "",
                maxlength: "200",
                disabled: At.value,
                autocomplete: "off"
              }, null, 8, jb), [
                [Jf, pt.value.title]
              ]),
              pt.value.error ? (p(), g("p", Zb, u(pt.value.error), 1)) : x("", !0),
              o("div", Hb, [
                o("button", {
                  type: "button",
                  disabled: At.value,
                  onClick: Yn
                }, u(_.value ? "取消" : "Cancel"), 9, Bb),
                o("button", {
                  type: "submit",
                  class: "is-primary",
                  disabled: At.value || !pt.value.title.trim()
                }, u(At.value ? _.value ? "保存中…" : "Saving…" : _.value ? "保存" : "Save"), 9, Vb)
              ])
            ], 32)
          ], 544)) : x("", !0)
        ])),
        o("div", Ub, [
          o("header", Wb, [
            o("div", Kb, [
              o("button", {
                type: "button",
                class: "oxc-icon-btn oxc-header-list-toggle",
                "aria-label": _.value ? "切换会话列表" : "Toggle conversation list",
                "aria-expanded": I.value,
                onClick: ks
              }, [...l[56] || (l[56] = [
                o("i", { class: "fa-solid fa-bars-staggered" }, null, -1)
              ])], 8, zb),
              o("h1", Gb, u(n.value.title), 1),
              o("button", {
                type: "button",
                class: "oxc-header__model",
                onClick: xc
              }, [
                l[57] || (l[57] = o("i", { class: "fa-solid fa-microchip" }, null, -1)),
                o("span", null, u(n.value.modelDisplay || n.value.model), 1)
              ])
            ]),
            o("div", Qb, [
              o("button", {
                type: "button",
                class: "oxc-icon-btn",
                onClick: xs,
                title: _.value ? "新对话" : "New chat"
              }, [...l[58] || (l[58] = [
                o("i", { class: "fa-solid fa-plus" }, null, -1)
              ])], 8, Jb),
              o("button", {
                type: "button",
                class: "oxc-icon-btn",
                onClick: kc,
                title: _.value ? "对话历史" : "History"
              }, [...l[59] || (l[59] = [
                o("i", { class: "fa-solid fa-clock-rotate-left" }, null, -1)
              ])], 8, Xb),
              o("div", {
                class: "oxc-quest-shell",
                onMousedown: l[10] || (l[10] = Re(() => {
                }, ["stop"])),
                onClick: l[11] || (l[11] = Re(() => {
                }, ["stop"]))
              }, [
                o("button", {
                  type: "button",
                  class: se(["oxc-icon-btn oxc-quest-trigger", { "is-active": R.value, [`is-${$s.value}`]: !0 }]),
                  onClick: Sc,
                  title: _.value ? "Meta Quest 3 连接" : "Meta Quest 3 connection"
                }, [
                  l[60] || (l[60] = o("i", { class: "fa-solid fa-vr-cardboard" }, null, -1)),
                  o("span", {
                    class: se(["oxc-quest-trigger__dot", `is-${$s.value}`])
                  }, null, 2)
                ], 10, Yb),
                Ke(It, { name: "oxc-pop" }, {
                  default: wt(() => [
                    R.value ? (p(), g("div", e_, [
                      o("div", t_, [
                        o("div", n_, [
                          l[61] || (l[61] = o("i", { class: "fa-brands fa-meta" }, null, -1)),
                          o("div", null, [
                            o("strong", null, u((_.value, "Meta Quest 3")), 1),
                            o("span", null, u(_.value ? "OpenXnet VR/MR 入口" : "OpenXnet VR/MR entry"), 1)
                          ])
                        ]),
                        o("span", {
                          class: se(["oxc-quest-status", `is-${$s.value}`])
                        }, [
                          l[62] || (l[62] = o("span", null, null, -1)),
                          Fe(" " + u(su.value), 1)
                        ], 2)
                      ]),
                      o("div", i_, [
                        o("div", s_, [
                          o("label", null, u(_.value ? "Quest 访问地址" : "Quest URL"), 1),
                          o("div", o_, [
                            o("span", { title: Qn.value }, u(Qn.value), 9, a_),
                            o("button", {
                              type: "button",
                              onClick: l[8] || (l[8] = (v) => da(Qn.value)),
                              title: _.value ? "复制地址" : "Copy URL"
                            }, [...l[63] || (l[63] = [
                              o("i", { class: "fa-regular fa-copy" }, null, -1)
                            ])], 8, r_)
                          ])
                        ]),
                        o("div", l_, [
                          o("div", c_, [
                            o("span", null, u(_.value ? "设备" : "Device"), 1),
                            o("strong", null, u(ou.value), 1)
                          ]),
                          o("div", u_, [
                            o("span", null, u(_.value ? "最后心跳" : "Last heartbeat"), 1),
                            o("strong", null, u(au.value), 1)
                          ]),
                          o("div", d_, [
                            o("span", null, u(_.value ? "协议" : "Protocol"), 1),
                            o("strong", null, u(En.value.gateway.protocol_version), 1)
                          ]),
                          o("div", f_, [
                            o("span", null, u(_.value ? "运行时" : "Runtime"), 1),
                            o("strong", null, u(ru.value), 1)
                          ])
                        ]),
                        o("div", v_, [
                          o("label", null, u(_.value ? "Quest 3 硬件能力" : "Quest 3 hardware"), 1),
                          o("div", p_, [
                            (p(!0), g(ye, null, Te(uu.value, (v) => (p(), g("div", {
                              key: v.key,
                              class: se(["oxc-quest-hardware-item", `is-${v.tone}`])
                            }, [
                              o("i", {
                                class: se(v.icon)
                              }, null, 2),
                              o("span", null, u(_.value ? v.zh : v.en), 1),
                              o("strong", null, u(v.text), 1)
                            ], 2))), 128))
                          ]),
                          o("p", h_, u(_.value ? "Quest 3 不向普通 Unity App 暴露原始雷达/LiDAR 点云；MR 侧使用 Passthrough、Depth API 与 Scene Mesh。" : "Quest 3 does not expose raw LiDAR/Radar point clouds to standard Unity apps; MR uses Passthrough, Depth API, and Scene Mesh."), 1)
                        ]),
                        o("div", g_, [
                          o("label", null, u(_.value ? "局域网地址" : "LAN URLs"), 1),
                          ka.value.length ? (p(), g("div", m_, [
                            (p(!0), g(ye, null, Te(ka.value, (v) => (p(), g("button", {
                              key: v.quest_url,
                              type: "button",
                              class: "oxc-quest-lan-item",
                              onClick: (O) => da(v.quest_url)
                            }, [
                              l[64] || (l[64] = o("i", { class: "fa-solid fa-wifi" }, null, -1)),
                              o("span", null, u(v.quest_url), 1)
                            ], 8, y_))), 128))
                          ])) : (p(), g("p", b_, u(_.value ? "暂无可用局域网地址，Quest 与电脑需在同一 Wi-Fi。" : "No LAN URL yet. Keep Quest and desktop on the same Wi-Fi."), 1))
                        ])
                      ]),
                      o("div", __, [
                        o("button", {
                          type: "button",
                          class: "oxc-quest-action",
                          disabled: P.value,
                          onClick: l[9] || (l[9] = (v) => ua())
                        }, [
                          o("i", {
                            class: se(P.value ? "fa-solid fa-spinner fa-spin" : "fa-solid fa-arrows-rotate")
                          }, null, 2),
                          o("span", null, u(_.value ? "刷新" : "Refresh"), 1)
                        ], 8, w_),
                        o("button", {
                          type: "button",
                          class: "oxc-quest-action",
                          onClick: Cc
                        }, [
                          l[65] || (l[65] = o("i", { class: "fa-solid fa-arrow-up-right-from-square" }, null, -1)),
                          o("span", null, u(_.value ? "打开入口" : "Open entry"), 1)
                        ])
                      ])
                    ])) : x("", !0)
                  ]),
                  _: 1
                })
              ], 32),
              o("button", {
                type: "button",
                class: se(["oxc-icon-btn", { "is-active": w.value }]),
                onClick: la,
                title: _.value ? "对话设置" : "Chat settings"
              }, [...l[66] || (l[66] = [
                o("i", { class: "fa-solid fa-sliders" }, null, -1)
              ])], 10, k_)
            ])
          ]),
          Ke(It, { name: "oxc-status" }, {
            default: wt(() => [
              ee.value.visible ? (p(), g("div", {
                key: 0,
                class: se(["oxc-status-banner", `is-${ee.value.tone}`])
              }, [
                o("i", {
                  class: se(ee.value.tone === "success" ? "fa-solid fa-circle-check" : ee.value.tone === "warning" ? "fa-solid fa-triangle-exclamation" : "fa-solid fa-circle-info")
                }, null, 2),
                o("span", null, u(ee.value.text), 1)
              ], 2)) : x("", !0)
            ]),
            _: 1
          }),
          o("div", {
            class: "oxc-main",
            style: un({ "--oxc-composer-space": Je.value })
          }, [
            Tn.value.length ? (p(), Lt(Yy, {
              key: Qe(gt)(n.value),
              messages: Tn.value,
              "active-id": he.value,
              "is-zh": _.value,
              onNavigate: oc
            }, null, 8, ["messages", "active-id", "is-zh"])) : x("", !0),
            o("div", {
              ref_key: "streamRef",
              ref: c,
              class: "oxc-stream",
              onScrollPassive: ic,
              onWheelPassive: Ri,
              onTouchmovePassive: Ri,
              onKeydown: Ri,
              onPointerdown: sc
            }, [
              o("div", x_, [
                n.value.isEmpty && He.value.loaded ? (p(), g("div", S_, [
                  o("div", C_, [
                    o("h2", A_, u(_.value ? `我们该在 ${He.value.name} 中做什么？` : `What shall we do in ${He.value.name}?`), 1),
                    o("p", I_, u(He.value.path), 1)
                  ])
                ])) : n.value.isEmpty ? (p(), g("div", $_, [
                  o("div", M_, [
                    Pn.value.image ? (p(), g("img", {
                      key: 0,
                      src: Pn.value.image,
                      alt: Pn.value.alt
                    }, null, 8, T_)) : (p(), g("img", P_))
                  ]),
                  o("span", E_, u(te.value.roleCardEnabled ? te.value.roleCardName : "OpenXnet"), 1),
                  o("h2", null, u(_.value ? "今天，一起完成什么？" : "What shall we work on today?"), 1),
                  o("p", null, u(te.value.model && te.value.model !== "未选择模型" && te.value.model !== "No model" ? _.value ? "从一个想法、一份文件，或一个问题开始。" : "Start with an idea, a file, or a question." : _.value ? "选择模型后开始。角色、记忆与工具随需加入。" : "Choose a model to begin. Add a role, memory and tools as needed."), 1),
                  o("div", R_, [
                    o("button", {
                      type: "button",
                      onClick: l[12] || (l[12] = (v) => hc(_.value ? "帮我梳理这个目标，先给出步骤和需要补充的信息：" : "Help me plan this goal, starting with steps and the information you need:"))
                    }, [
                      l[67] || (l[67] = o("i", { class: "fa-solid fa-route" }, null, -1)),
                      Fe(u(_.value ? "梳理一项任务" : "Plan a task"), 1)
                    ]),
                    o("button", {
                      type: "button",
                      onClick: fa
                    }, [
                      l[68] || (l[68] = o("i", { class: "fa-regular fa-file-lines" }, null, -1)),
                      Fe(u(_.value ? "从文件开始" : "Start with a file"), 1)
                    ]),
                    o("button", {
                      type: "button",
                      onClick: ma
                    }, [
                      l[69] || (l[69] = o("i", { class: "fa-regular fa-address-card" }, null, -1)),
                      Fe(u(_.value ? "配置角色与头像" : "Roles and portraits"), 1)
                    ])
                  ])
                ])) : (p(!0), g(ye, { key: 2 }, Te(xu.value, (v) => (p(), g("article", {
                  key: v.id,
                  "data-message-id": v.id,
                  tabindex: "-1",
                  class: se(["oxc-msg", [
                    `is-${v.role === "assistant" ? "ai" : "user"}`,
                    { "is-same-role": v.sameRole },
                    { "is-typing": v.typing },
                    { "is-streaming": v.streaming },
                    { "is-located": he.value === v.id },
                    { "is-navigation-target": Se.value === v.id }
                  ]])
                }, [
                  v.role === "assistant" ? (p(), g("button", {
                    key: 0,
                    type: "button",
                    class: "oxc-msg__avatar",
                    "aria-label": `${$n(v).name} · ${_.value ? "查看身份" : "View identity"}`,
                    onClick: (O) => zn(v.id, { kind: "identity" })
                  }, [
                    $n(v).image ? (p(), g("img", {
                      key: 0,
                      src: $n(v).image,
                      alt: $n(v).name
                    }, null, 8, O_)) : (p(), g("span", D_, u($n(v).text), 1))
                  ], 8, L_)) : x("", !0),
                  o("div", F_, [
                    v.role === "assistant" && !v.sameRole ? (p(), g("span", q_, u($n(v).name), 1)) : x("", !0),
                    v.role === "assistant" && v.activity?.visible ? (p(), Lt(Th, {
                      key: 1,
                      activity: v.activity,
                      "is-zh": _.value,
                      onInspect: (O) => zn(v.id, O)
                    }, null, 8, ["activity", "is-zh", "onInspect"])) : x("", !0),
                    v.memoryContext?.length ? (p(), g("button", {
                      key: 2,
                      type: "button",
                      class: "oxc-memory-receipt",
                      onClick: (O) => zn(v.id, { kind: "memory" })
                    }, [
                      l[70] || (l[70] = o("i", { class: "fa-solid fa-layer-group" }, null, -1)),
                      Fe(u(_.value ? "查看本轮记忆来源" : "Memory sources for this turn"), 1),
                      l[71] || (l[71] = o("i", { class: "fa-solid fa-chevron-right" }, null, -1))
                    ], 8, j_)) : x("", !0),
                    v.attachments?.length ? (p(), g("div", Z_, [
                      (p(!0), g(ye, null, Te(v.attachments, (O, ke) => (p(), g("div", {
                        key: O.id || ke,
                        class: "oxc-sent-attachment"
                      }, [
                        O.kind === "image" && (O.url || O.path) ? (p(), g("img", {
                          key: 0,
                          src: O.url || O.path,
                          alt: O.name || (_.value ? "图片附件" : "Image attachment"),
                          loading: "lazy"
                        }, null, 8, H_)) : (p(), g("span", B_, [
                          l[72] || (l[72] = o("i", { class: "fa-regular fa-file-lines" }, null, -1)),
                          Fe(u(O.name || (_.value ? "附件" : "Attachment")), 1)
                        ]))
                      ]))), 128))
                    ])) : x("", !0),
                    v.typing && !v.activity?.visible ? (p(), g("div", V_, [...l[73] || (l[73] = [
                      o("div", { class: "oxc-typing-dots" }, [
                        o("span"),
                        o("span"),
                        o("span")
                      ], -1)
                    ])])) : v.role === "assistant" && v.html ? Rt((p(), g("div", U_, null, 512)), [
                      [tc, v.html]
                    ]) : v.role !== "assistant" ? (p(), g("div", W_, u(v.text), 1)) : x("", !0),
                    ge.value && $.value === v.id ? (p(), Lt(kr, {
                      key: z.value,
                      state: ge.value,
                      "is-zh": _.value,
                      busy: N.value,
                      continuing: U.value && (T.value || F.value.pending),
                      "action-error": Y.value || (U.value ? S.value : ""),
                      onCheck: Yo,
                      onContinue: ea
                    }, null, 8, ["state", "is-zh", "busy", "continuing", "action-error"])) : x("", !0),
                    v.typing ? x("", !0) : (p(), g("div", K_, [
                      v.text ? (p(), g("button", {
                        key: 0,
                        type: "button",
                        "aria-label": _.value ? "复制消息" : "Copy message",
                        title: _.value ? "复制消息" : "Copy message",
                        onClick: (O) => vc(v)
                      }, [...l[74] || (l[74] = [
                        o("i", { class: "fa-regular fa-copy" }, null, -1)
                      ])], 8, z_)) : x("", !0),
                      v.text ? (p(), g("button", {
                        key: 1,
                        type: "button",
                        "aria-label": _.value ? "引用到草稿" : "Quote in draft",
                        title: _.value ? "引用到草稿" : "Quote in draft",
                        onClick: (O) => pc(v)
                      }, [...l[75] || (l[75] = [
                        o("i", { class: "fa-solid fa-quote-left" }, null, -1)
                      ])], 8, G_)) : x("", !0),
                      o("button", {
                        type: "button",
                        "aria-label": _.value ? "消息详情" : "Message details",
                        title: _.value ? "消息详情" : "Message details",
                        onClick: (O) => zn(v.id, { kind: "identity" })
                      }, [...l[76] || (l[76] = [
                        o("i", { class: "fa-solid fa-ellipsis" }, null, -1)
                      ])], 8, Q_),
                      v.time ? (p(), g("time", J_, u(v.time), 1)) : x("", !0)
                    ]))
                  ])
                ], 10, N_))), 128)),
                ge.value && !$.value ? (p(), Lt(kr, {
                  key: z.value,
                  state: ge.value,
                  "is-zh": _.value,
                  busy: N.value,
                  continuing: U.value && (T.value || F.value.pending),
                  "action-error": Y.value || (U.value ? S.value : ""),
                  onCheck: Yo,
                  onContinue: ea
                }, null, 8, ["state", "is-zh", "busy", "continuing", "action-error"])) : x("", !0),
                ne.value.tasks.length || ne.value.error ? (p(), g("section", {
                  key: 4,
                  class: "oxc-automation-cards",
                  "aria-label": _.value ? "当前会话自动任务" : "Current conversation automations"
                }, [
                  (p(!0), g(ye, null, Te(ne.value.tasks, (v) => (p(), g("button", {
                    key: v.id,
                    type: "button",
                    class: "oxc-automation-card",
                    "data-automation-id": v.id,
                    onClick: (O) => rc(v.id)
                  }, [
                    o("span", e1, [
                      o("span", t1, [
                        l[77] || (l[77] = o("i", {
                          class: "fa-regular fa-clock",
                          "aria-hidden": "true"
                        }, null, -1)),
                        Fe(u(_.value ? "自动任务" : "Automation"), 1)
                      ]),
                      o("span", null, u(cc(v.state)), 1)
                    ]),
                    o("strong", null, u(v.title || (_.value ? "自动任务" : "Automation")), 1),
                    v.state === "active" && v.nextRunAt ? (p(), g("span", {
                      key: 0,
                      class: "oxc-automation-card__next",
                      title: v.nextRunAt
                    }, u(_.value ? "下一次检查" : "Next check") + " · " + u(uc(v.nextRunAt)), 9, n1)) : x("", !0),
                    Xo(v) ? (p(), g("span", i1, [
                      o("small", null, u(_.value ? "自动任务结果" : "Automation result"), 1),
                      Fe(u(Xo(v).summary), 1)
                    ])) : x("", !0)
                  ], 8, Y_))), 128)),
                  ne.value.error ? (p(), g("p", s1, u(ne.value.error), 1)) : x("", !0)
                ], 8, X_)) : x("", !0)
              ])
            ], 544),
            o("div", {
              ref_key: "inputWrapperRef",
              ref: f,
              class: "oxc-input-wrapper"
            }, [
              Ke(Iy, {
                state: r.value,
                "is-zh": _.value,
                running: n.value.isSending,
                bridge: Qe(t),
                onChanged: l[13] || (l[13] = (v) => Ae(!1, { passive: !0 })),
                onRestoreText: _c
              }, null, 8, ["state", "is-zh", "running", "bridge"]),
              F.value.error || !U.value && (F.value.available || T.value && !n.value.isSending || S.value) ? (p(), g("div", {
                key: 0,
                class: "oxc-recovery-banner",
                "aria-busy": T.value || F.value.pending
              }, [
                o("div", null, [
                  o("strong", null, u(F.value.error ? _.value ? "会话还有内容未保存" : "Some conversation content is not saved" : _.value ? "发现未完成的回复" : "An unfinished reply was found"), 1),
                  o("p", null, u(S.value || F.value.error || F.value.reason || (_.value ? "已保留上次保存的内容。继续前会核对原执行状态。" : "Saved content is retained. The original execution will be checked before continuing.")), 1)
                ]),
                F.value.error ? (p(), g("button", {
                  key: 0,
                  type: "button",
                  "data-recovery-action": "save",
                  disabled: T.value || F.value.pending || n.value.isSending,
                  onClick: l[14] || (l[14] = (v) => ws(!0))
                }, u(_.value ? "重试保存" : "Retry saving"), 9, a1)) : F.value.available || T.value ? (p(), g("button", {
                  key: 1,
                  type: "button",
                  "data-recovery-action": "continue",
                  disabled: T.value || F.value.pending || n.value.isSending,
                  onClick: l[15] || (l[15] = (v) => ws(!1))
                }, [
                  o("i", {
                    class: se(T.value || F.value.pending ? "fa-solid fa-spinner fa-spin" : "fa-solid fa-play"),
                    "aria-hidden": "true"
                  }, null, 2),
                  Fe(u(T.value || F.value.pending ? _.value ? "正在核对" : "Checking" : _.value ? "继续" : "Continue"), 1)
                ], 8, r1)) : x("", !0)
              ], 8, o1)) : x("", !0),
              ve.value || de.value ? (p(), g("button", {
                key: 1,
                type: "button",
                class: "oxc-return-latest",
                onClick: Jo
              }, [
                l[78] || (l[78] = o("i", { class: "fa-solid fa-arrow-down" }, null, -1)),
                Fe(u(de.value ? _.value ? "有新内容 · 回到最新" : "New content · Latest" : _.value ? "回到最新" : "Back to latest"), 1)
              ])) : x("", !0),
              Ke(It, { name: "oxc-pop" }, {
                default: wt(() => [
                  Qc.value ? (p(), g("div", l1, [
                    l[81] || (l[81] = o("i", { class: "fa-solid fa-triangle-exclamation" }, null, -1)),
                    o("div", c1, [
                      o("strong", null, u(_.value ? "订阅积分不足" : "Low credits"), 1),
                      o("span", null, u(Jc.value), 1)
                    ]),
                    o("button", {
                      type: "button",
                      class: "oxc-low-credits-banner__cta",
                      onClick: _a
                    }, [
                      l[79] || (l[79] = o("i", { class: "fa-solid fa-arrow-up-right-from-square" }, null, -1)),
                      o("span", null, u(_.value ? "充值 / 续费" : "Top up"), 1)
                    ]),
                    o("button", {
                      type: "button",
                      class: "oxc-low-credits-banner__close",
                      onClick: Xc,
                      title: _.value ? "关闭" : "Dismiss"
                    }, [...l[80] || (l[80] = [
                      o("i", { class: "fa-solid fa-xmark" }, null, -1)
                    ])], 8, u1)
                  ])) : x("", !0)
                ]),
                _: 1
              }),
              hn.value.count ? (p(), g("button", {
                key: 2,
                type: "button",
                class: "oxc-file-summary",
                onClick: dc
              }, [
                l[82] || (l[82] = o("i", {
                  class: "fa-regular fa-file-code",
                  "aria-hidden": "true"
                }, null, -1)),
                o("span", null, u(_.value ? `本轮 ${hn.value.count} 个文件已变更` : `${hn.value.count} files changed this turn`), 1),
                hn.value.additions !== null ? (p(), g("span", d1, "+" + u(hn.value.additions), 1)) : x("", !0),
                hn.value.deletions !== null ? (p(), g("span", f1, "−" + u(hn.value.deletions), 1)) : x("", !0),
                l[83] || (l[83] = o("i", {
                  class: "fa-solid fa-chevron-right",
                  "aria-hidden": "true"
                }, null, -1))
              ])) : x("", !0),
              o("div", v1, [
                j.value ? (p(), g("p", p1, u(j.value), 1)) : x("", !0),
                M.value ? (p(), g("p", h1, u(M.value), 1)) : x("", !0),
                sn.value.length ? (p(), g("div", g1, [
                  (p(!0), g(ye, null, Te(sn.value, (v) => (p(), g("div", {
                    key: v.kind + ":" + v.index + ":" + v.name,
                    class: se(["oxc-attachment", `is-${v.kind}`])
                  }, [
                    v.kind === "image" ? (p(), g("img", {
                      key: 0,
                      src: v.path,
                      alt: v.name,
                      class: "oxc-attachment__thumb"
                    }, null, 8, m1)) : (p(), g(ye, { key: 1 }, [
                      l[84] || (l[84] = o("span", { class: "oxc-attachment__file-icon" }, [
                        o("i", { class: "fa-regular fa-file" })
                      ], -1)),
                      o("span", {
                        class: "oxc-attachment__file-name",
                        title: v.name
                      }, u(v.name), 9, y1)
                    ], 64)),
                    o("button", {
                      type: "button",
                      class: "oxc-attachment__remove",
                      title: _.value ? "移除" : "Remove",
                      onClick: (O) => yc(v)
                    }, [...l[85] || (l[85] = [
                      o("i", { class: "fa-solid fa-xmark" }, null, -1)
                    ])], 8, b1)
                  ], 2))), 128))
                ])) : x("", !0),
                o("textarea", {
                  ref_key: "textareaRef",
                  ref: m,
                  value: i.value,
                  class: "oxc-input-card__textarea",
                  placeholder: Wc.value,
                  rows: "1",
                  onInput: nc,
                  onKeydown: wc,
                  onPaste: mc
                }, null, 40, _1),
                o("div", w1, [
                  o("div", k1, [
                    o("button", {
                      type: "button",
                      class: "oxc-toolbar-btn",
                      title: _.value ? "上传文件" : "Attach file",
                      onClick: fa
                    }, [...l[86] || (l[86] = [
                      o("i", { class: "fa-solid fa-paperclip" }, null, -1)
                    ])], 8, x1),
                    te.value.tablePetAvailable ? Rt((p(), g("button", {
                      key: 0,
                      type: "button",
                      class: "oxc-toolbar-btn",
                      title: _.value ? "桌面宠物" : "Desktop pet",
                      onClick: Fc
                    }, [...l[87] || (l[87] = [
                      o("i", { class: "fa-solid fa-user-astronaut" }, null, -1)
                    ])], 8, S1)), [
                      [an, V.value]
                    ]) : x("", !0),
                    te.value.roleCardAvailable ? (p(), g("div", {
                      key: 1,
                      class: "oxc-popover-wrap oxc-role-card-wrap",
                      onMousedown: l[17] || (l[17] = Re(() => {
                      }, ["stop"])),
                      onClick: l[18] || (l[18] = Re(() => {
                      }, ["stop"]))
                    }, [
                      o("button", {
                        type: "button",
                        class: se(["oxc-toolbar-btn oxc-role-trigger", { "is-active": A.value || te.value.roleCardEnabled }]),
                        title: zc.value,
                        onClick: qc
                      }, [
                        Pn.value.image ? (p(), g("img", {
                          key: 0,
                          src: Pn.value.image,
                          alt: Pn.value.alt
                        }, null, 8, A1)) : (p(), g("i", I1)),
                        o("span", null, u(te.value.roleCardEnabled ? te.value.roleCardName : _.value ? "角色" : "Role"), 1)
                      ], 10, C1),
                      Ke(It, { name: "oxc-pop" }, {
                        default: wt(() => [
                          A.value ? (p(), g("div", $1, [
                            o("div", M1, [
                              o("span", null, u(_.value ? "角色卡" : "Role card"), 1),
                              o("small", null, u(te.value.roleCardEnabled ? te.value.roleCardName : _.value ? "未启用" : "Off"), 1)
                            ]),
                            te.value.roleCardEnabled ? (p(), g("button", {
                              key: 0,
                              type: "button",
                              class: "oxc-popover__option",
                              onClick: Zc
                            }, [
                              l[88] || (l[88] = o("i", { class: "fa-solid fa-toggle-off" }, null, -1)),
                              o("div", T1, [
                                o("strong", null, u(_.value ? "停用当前角色卡" : "Disable current role card"), 1),
                                o("small", null, u(_.value ? "本次对话不再注入角色档案" : "Stop injecting role profile into this chat"), 1)
                              ])
                            ])) : x("", !0),
                            ya.value.length ? (p(), g("div", P1, [
                              (p(!0), g(ye, null, Te(ya.value, (v) => (p(), g("button", {
                                key: v.id,
                                type: "button",
                                class: se(["oxc-popover__option oxc-role-card-option", { "is-active": v.id === te.value.roleCardSelectedId && te.value.roleCardEnabled }]),
                                onClick: (O) => jc(v)
                              }, [
                                o("span", {
                                  class: "oxc-role-card-avatar",
                                  style: un({ background: v.avatarBackground })
                                }, [
                                  v.avatarImage ? (p(), g("img", {
                                    key: 0,
                                    src: v.avatarImage,
                                    alt: v.name
                                  }, null, 8, R1)) : (p(), g("span", N1, u(v.avatarText || v.initial), 1))
                                ], 4),
                                o("div", L1, [
                                  o("strong", null, u(v.name), 1),
                                  o("small", null, u(v.desc), 1)
                                ]),
                                o("span", O1, u(v.tag), 1)
                              ], 10, E1))), 128))
                            ])) : (p(), g("div", D1, u(_.value ? "还没有可用角色卡" : "No role cards yet"), 1)),
                            o("button", {
                              type: "button",
                              class: "oxc-popover__cta",
                              onClick: ma
                            }, [
                              l[89] || (l[89] = o("i", { class: "fa-solid fa-sliders" }, null, -1)),
                              o("span", null, u(_.value ? "角色卡配置" : "Configure role cards"), 1)
                            ]),
                            o("button", {
                              type: "button",
                              class: "oxc-popover__cta",
                              disabled: !te.value.roleCardSelectedId || B.value,
                              onClick: l[16] || (l[16] = (v) => H.value?.click())
                            }, [
                              l[90] || (l[90] = o("i", { class: "fa-regular fa-image" }, null, -1)),
                              Fe(u(B.value ? _.value ? "保存头像中…" : "Saving portrait…" : _.value ? "为当前角色导入头像" : "Import portrait for this role"), 1)
                            ], 8, F1)
                          ])) : x("", !0)
                        ]),
                        _: 1
                      })
                    ], 32)) : x("", !0),
                    Rt(o("button", {
                      type: "button",
                      class: se(["oxc-toolbar-btn", { "is-active": te.value.webSearchEnabled }]),
                      title: _.value ? "联网搜索" : "Web search",
                      onClick: Rc
                    }, [...l[91] || (l[91] = [
                      o("i", { class: "fa-solid fa-globe" }, null, -1)
                    ])], 10, q1), [
                      [an, V.value || te.value.webSearchEnabled]
                    ]),
                    Rt(o("button", {
                      type: "button",
                      class: se(["oxc-toolbar-btn", { "is-active": n.value.interpreterEnabled }]),
                      title: _.value ? "代码解释器" : "Code interpreter",
                      onClick: va
                    }, [...l[92] || (l[92] = [
                      o("i", { class: "fa-solid fa-code" }, null, -1)
                    ])], 10, j1), [
                      [an, V.value || n.value.interpreterEnabled]
                    ]),
                    o("div", {
                      class: "oxc-popover-wrap",
                      onMousedown: l[19] || (l[19] = Re(() => {
                      }, ["stop"])),
                      onClick: l[20] || (l[20] = Re(() => {
                      }, ["stop"]))
                    }, [
                      o("button", {
                        type: "button",
                        class: se(["oxc-toolbar-btn oxc-memory-trigger", { "is-active": te.value.memoryEnabled || te.value.nativeMemoryEnabled }]),
                        "aria-expanded": ie.value,
                        title: _.value ? "记忆与上下文" : "Memory and context",
                        onClick: yt
                      }, [...l[93] || (l[93] = [
                        o("i", { class: "fa-solid fa-layer-group" }, null, -1)
                      ])], 10, Z1),
                      ie.value ? (p(), g("div", H1, [
                        o("div", B1, [
                          o("strong", null, u(_.value ? "记忆与身份" : "Memory and identity"), 1)
                        ]),
                        te.value.memoryAvailable ? (p(), g("button", {
                          key: 0,
                          type: "button",
                          class: "oxc-popover__option",
                          onClick: pa
                        }, [
                          l[94] || (l[94] = o("i", { class: "fa-regular fa-address-card" }, null, -1)),
                          o("div", V1, [
                            o("strong", null, u(_.value ? "角色档案与角色记忆" : "Role profile and role memory"), 1),
                            o("small", null, u(te.value.roleCardName || (_.value ? "尚未选择角色" : "No role selected")), 1)
                          ]),
                          o("span", null, u(te.value.memoryEnabled ? _.value ? "开启" : "On" : _.value ? "关闭" : "Off"), 1)
                        ])) : x("", !0),
                        o("button", {
                          type: "button",
                          class: "oxc-popover__option",
                          disabled: !te.value.nativeMemoryAvailable,
                          onClick: ha
                        }, [
                          l[95] || (l[95] = o("i", { class: "fa-solid fa-brain" }, null, -1)),
                          o("div", W1, [
                            o("strong", null, u(_.value ? "原生 Memory V3" : "Native Memory V3"), 1),
                            o("small", null, u(_.value ? "按当前身份与任务权限检索" : "Retrieve within current identity and task permissions"), 1)
                          ]),
                          o("span", null, u(te.value.nativeMemoryEnabled ? _.value ? "开启" : "On" : _.value ? "关闭" : "Off"), 1)
                        ], 8, U1),
                        o("p", K1, u(_.value ? "开关作用于后续请求。本轮是否使用、来源与结果，请查看消息中的记忆记录。" : "Settings apply to future requests. Each message shows whether memory was used and its sources."), 1)
                      ])) : x("", !0)
                    ], 32),
                    o("button", {
                      type: "button",
                      class: se(["oxc-toolbar-btn", { "is-active": n.value.asrEnabled }]),
                      title: _.value ? "语音输入" : "Voice input",
                      onClick: Tc
                    }, [...l[96] || (l[96] = [
                      o("i", { class: "fa-solid fa-microphone" }, null, -1)
                    ])], 10, z1),
                    o("button", {
                      type: "button",
                      class: se(["oxc-toolbar-btn oxc-tools-trigger", { "is-active": V.value }]),
                      "aria-expanded": V.value,
                      onClick: l[21] || (l[21] = (v) => V.value = !V.value)
                    }, [
                      l[97] || (l[97] = o("i", { class: "fa-solid fa-sliders" }, null, -1)),
                      o("span", null, u(_.value ? "工具" : "Tools"), 1)
                    ], 10, G1),
                    o("div", Q1, [
                      o("button", {
                        type: "button",
                        class: se(["oxc-toolbar-btn", { "is-active": C.value || te.value.browserControlEnabled || te.value.ttsEnabled || te.value.desktopVisionEnabled }]),
                        title: _.value ? "更多" : "More",
                        onClick: Hc
                      }, [...l[98] || (l[98] = [
                        o("i", { class: "fa-solid fa-ellipsis" }, null, -1)
                      ])], 10, J1),
                      Ke(It, { name: "oxc-pop" }, {
                        default: wt(() => [
                          C.value ? (p(), g("div", {
                            key: 0,
                            class: "oxc-popover",
                            onMousedown: l[22] || (l[22] = Re(() => {
                            }, ["stop"])),
                            onClick: l[23] || (l[23] = Re(() => {
                            }, ["stop"]))
                          }, [
                            o("button", {
                              type: "button",
                              class: "oxc-popover-item",
                              onClick: Mc
                            }, [
                              l[99] || (l[99] = o("span", { class: "oxc-popover-item__icon" }, [
                                o("i", { class: "fa-regular fa-image" })
                              ], -1)),
                              o("span", X1, u(_.value ? "上传图片" : "Upload images"), 1)
                            ]),
                            te.value.browserControlAvailable ? (p(), g("button", {
                              key: 0,
                              type: "button",
                              class: se(["oxc-popover-item", { "is-active": te.value.browserControlEnabled }]),
                              onClick: Nc
                            }, [
                              l[100] || (l[100] = o("span", { class: "oxc-popover-item__icon" }, [
                                o("i", { class: "fa-solid fa-compass" })
                              ], -1)),
                              o("span", Y1, u(_.value ? "浏览器控制" : "Browser control"), 1),
                              o("span", {
                                class: se(["oxc-popover-item__badge", { "is-on": te.value.browserControlEnabled }])
                              }, u(te.value.browserControlEnabled ? _.value ? "已开" : "On" : _.value ? "已关" : "Off"), 3)
                            ], 2)) : x("", !0),
                            te.value.desktopVisionAvailable ? (p(), g("button", {
                              key: 1,
                              type: "button",
                              class: se(["oxc-popover-item", { "is-active": te.value.desktopVisionEnabled }]),
                              onClick: Oc
                            }, [
                              l[101] || (l[101] = o("span", { class: "oxc-popover-item__icon" }, [
                                o("i", { class: "fa-solid fa-eye" })
                              ], -1)),
                              o("span", ew, u(_.value ? "桌面视觉" : "Desktop vision"), 1),
                              o("span", {
                                class: se(["oxc-popover-item__badge", { "is-on": te.value.desktopVisionEnabled }])
                              }, u(te.value.desktopVisionEnabled ? _.value ? "已开" : "On" : _.value ? "已关" : "Off"), 3)
                            ], 2)) : x("", !0),
                            te.value.ttsAvailable ? (p(), g("button", {
                              key: 2,
                              type: "button",
                              class: se(["oxc-popover-item", { "is-active": te.value.ttsEnabled }]),
                              onClick: Lc
                            }, [
                              l[102] || (l[102] = o("span", { class: "oxc-popover-item__icon" }, [
                                o("i", { class: "fa-solid fa-volume-high" })
                              ], -1)),
                              o("span", tw, u(_.value ? "语音播报" : "Text-to-speech"), 1),
                              o("span", {
                                class: se(["oxc-popover-item__badge", { "is-on": te.value.ttsEnabled }])
                              }, u(te.value.ttsEnabled ? _.value ? "已开" : "On" : _.value ? "已关" : "Off"), 3)
                            ], 2)) : x("", !0),
                            te.value.screenshotAvailable ? (p(), g("button", {
                              key: 3,
                              type: "button",
                              class: "oxc-popover-item",
                              onClick: Dc
                            }, [
                              l[103] || (l[103] = o("span", { class: "oxc-popover-item__icon" }, [
                                o("i", { class: "fa-solid fa-camera" })
                              ], -1)),
                              o("span", nw, u(_.value ? "截图" : "Screenshot"), 1)
                            ])) : x("", !0)
                          ], 32)) : x("", !0)
                        ]),
                        _: 1
                      })
                    ])
                  ]),
                  o("div", iw, [
                    o("div", {
                      class: "oxc-chip-shell oxc-permission-shell",
                      onMousedown: l[27] || (l[27] = Re(() => {
                      }, ["stop"])),
                      onClick: l[28] || (l[28] = Re(() => {
                      }, ["stop"]))
                    }, [
                      o("button", {
                        type: "button",
                        class: se(["oxc-chip oxc-chip--permission", {
                          "is-bypass": ["bypassPermissions", "yolo"].includes(Oe.value.current),
                          "is-accept": ["acceptEdits", "auto-approve", "auto-edit"].includes(Oe.value.current),
                          "is-plan": Oe.value.current === "plan"
                        }]),
                        title: `${_.value ? "权限模式" : "Permission mode"} · ${Is(Oe.value.current)}`,
                        "aria-label": `${_.value ? "权限模式" : "Permission mode"} · ${Is(Oe.value.current)}`,
                        "aria-expanded": ht.value,
                        "aria-controls": "oxc-permission-menu",
                        "aria-busy": ce.value || Oe.value.pending || !1,
                        onClick: Yc
                      }, [
                        o("i", {
                          class: se(tu(Oe.value.current))
                        }, null, 2),
                        o("span", ow, u(Is(Oe.value.current)), 1),
                        Oe.value.uncertain ? (p(), g("span", aw, u(_.value ? "待确认" : "Unconfirmed"), 1)) : x("", !0),
                        o("i", {
                          class: se(ce.value || Oe.value.pending ? "fa-solid fa-spinner fa-spin oxc-chip__caret" : "fa-solid fa-chevron-down oxc-chip__caret"),
                          "aria-hidden": "true"
                        }, null, 2)
                      ], 10, sw),
                      Ke(It, { name: "oxc-pop" }, {
                        default: wt(() => [
                          Rt(o("div", {
                            id: "oxc-permission-menu",
                            class: "oxc-popover oxc-popover--up oxc-popover--permission",
                            role: "group",
                            "aria-label": _.value ? "权限模式选项" : "Permission mode options",
                            onMousedown: l[25] || (l[25] = Re(() => {
                            }, ["stop"])),
                            onClick: l[26] || (l[26] = Re(() => {
                            }, ["stop"]))
                          }, [
                            o("div", lw, u(_.value ? "权限模式" : "Permission Mode"), 1),
                            Oe.value.scopeHint ? (p(), g("p", cw, u(Oe.value.scopeHint), 1)) : x("", !0),
                            ce.value || Oe.value.pending ? (p(), g("p", uw, u(_.value ? "正在保存，当前仍显示原模式…" : "Saving; the previous mode is still shown…"), 1)) : x("", !0),
                            (p(!0), g(ye, null, Te(Oe.value.options, (v) => (p(), g("button", {
                              key: v.id,
                              type: "button",
                              class: se(["oxc-popover__option", { "is-active": v.id === Oe.value.current }]),
                              "data-permission-mode": v.id,
                              "aria-pressed": v.id === Oe.value.current,
                              disabled: ce.value || Oe.value.pending || Oe.value.available === !1 || v.disabled || !1,
                              onMousedown: l[24] || (l[24] = Re(() => {
                              }, ["stop"])),
                              onClick: Re((O) => eu(v.id), ["stop"])
                            }, [
                              o("i", {
                                class: se(v.icon)
                              }, null, 2),
                              o("div", fw, [
                                o("strong", null, u(v.label), 1),
                                o("small", null, u(v.desc), 1)
                              ]),
                              v.id === Oe.value.current ? (p(), g("i", vw)) : x("", !0)
                            ], 42, dw))), 128))
                          ], 40, rw), [
                            [an, ht.value]
                          ])
                        ]),
                        _: 1
                      })
                    ], 32),
                    St.value.active ? (p(), g("div", {
                      key: 0,
                      class: "oxc-chip-shell",
                      onMousedown: l[29] || (l[29] = Re(() => {
                      }, ["stop"])),
                      onClick: l[30] || (l[30] = Re(() => {
                      }, ["stop"]))
                    }, [
                      o("button", {
                        type: "button",
                        class: "oxc-chip oxc-chip--credits",
                        title: St.value.summary,
                        onClick: iu
                      }, [
                        l[104] || (l[104] = o("i", { class: "fa-solid fa-coins" }, null, -1)),
                        o("span", hw, u(St.value.label), 1)
                      ], 8, pw),
                      Ke(It, { name: "oxc-pop" }, {
                        default: wt(() => [
                          Rt(o("div", gw, [
                            o("div", mw, [
                              o("strong", null, u(_.value ? "订阅积分" : "Subscription Credits"), 1),
                              o("small", null, u(St.value.planName), 1),
                              o("button", {
                                type: "button",
                                class: se(["oxc-popover__refresh", { "is-spinning": Gn.value }]),
                                title: _.value ? "刷新额度" : "Refresh credits",
                                disabled: Gn.value,
                                onClick: Re(ba, ["stop"])
                              }, [...l[105] || (l[105] = [
                                o("i", { class: "fa-solid fa-arrows-rotate" }, null, -1)
                              ])], 10, yw)
                            ]),
                            o("div", bw, [
                              o("div", _w, [
                                o("span", null, u(_.value ? "日剩余" : "Daily Left"), 1),
                                o("strong", null, u(St.value.dailyRemaining), 1)
                              ]),
                              o("div", ww, [
                                o("span", null, u(_.value ? "日额度" : "Daily Quota"), 1),
                                o("strong", null, u(St.value.dailyQuota || "—"), 1)
                              ]),
                              o("div", kw, [
                                o("span", null, u(_.value ? "赠送" : "Bonus"), 1),
                                o("strong", null, u(St.value.bonusCredits), 1)
                              ]),
                              o("div", xw, [
                                o("span", null, u(_.value ? "加油包" : "Top-up"), 1),
                                o("strong", null, u(St.value.topupCredits), 1)
                              ])
                            ]),
                            o("button", {
                              type: "button",
                              class: "oxc-popover__cta",
                              onClick: _a
                            }, [
                              l[106] || (l[106] = o("i", { class: "fa-solid fa-arrow-up-right-from-square" }, null, -1)),
                              o("span", null, u(_.value ? "打开订阅中心" : "Open subscription center"), 1)
                            ])
                          ], 512), [
                            [an, Ct.value]
                          ])
                        ]),
                        _: 1
                      })
                    ], 32)) : x("", !0),
                    o("div", {
                      class: "oxc-chip-shell",
                      onMousedown: l[31] || (l[31] = Re(() => {
                      }, ["stop"])),
                      onClick: l[32] || (l[32] = Re(() => {
                      }, ["stop"]))
                    }, [
                      o("button", {
                        type: "button",
                        class: se(["oxc-context-ring", { "is-warn": at.value.warn, "is-critical": at.value.critical }]),
                        title: `${at.value.label} · ${at.value.summary}`,
                        "aria-label": _.value ? "查看上下文用量与来源" : "View context usage and source",
                        onClick: nu
                      }, [
                        (p(), g("svg", Cw, [
                          l[107] || (l[107] = o("circle", {
                            class: "oxc-context-ring__track",
                            cx: "12",
                            cy: "12",
                            r: "9"
                          }, null, -1)),
                          o("circle", {
                            class: "oxc-context-ring__fill",
                            cx: "12",
                            cy: "12",
                            r: "9",
                            "stroke-dasharray": wa.value.circumference,
                            "stroke-dashoffset": wa.value.offset,
                            transform: "rotate(-90 12 12)"
                          }, null, 8, Aw)
                        ])),
                        o("span", Iw, u(at.value.percent == null ? "—" : `${at.value.percent}%`), 1)
                      ], 10, Sw),
                      Ke(It, { name: "oxc-pop" }, {
                        default: wt(() => [
                          Rt(o("div", $w, [
                            o("div", Mw, [
                              o("strong", null, u(_.value ? "上下文窗口" : "Context Window"), 1),
                              o("small", null, u(at.value.label), 1)
                            ]),
                            at.value.percent != null ? (p(), g("div", Tw, [
                              o("div", {
                                class: "oxc-context-bar__fill",
                                style: un({ width: at.value.percent + "%" })
                              }, null, 4)
                            ])) : x("", !0),
                            o("p", Pw, [
                              l[108] || (l[108] = o("i", { class: "fa-solid fa-circle-info" }, null, -1)),
                              Fe(" " + u(at.value.actual ? _.value ? "用量来自上次请求的服务商回执，不代表尚未提交的完整输入。" : "Usage comes from the previous provider response, not the complete next input." : _.value ? "当前数值由消息字符估算，不包含所有隐藏输入；实际用量以服务商回执为准。" : "This estimate uses message characters and excludes some hidden inputs; provider receipts determine actual usage."), 1)
                            ]),
                            o("div", Ew, [
                              o("div", null, [
                                o("span", null, u(at.value.actual ? _.value ? "上次实际输入" : "Last actual input" : _.value ? "当前估算" : "Current estimate"), 1),
                                o("strong", null, u(at.value.used ?? "—"), 1)
                              ]),
                              o("div", null, [
                                o("span", null, u(_.value ? "配置上限" : "Configured limit"), 1),
                                o("strong", null, u(at.value.limit ?? (_.value ? "未知" : "Unknown")), 1)
                              ]),
                              o("div", null, [
                                o("span", null, u(_.value ? "状态" : "Status"), 1),
                                o("strong", null, u(at.value.summary), 1)
                              ])
                            ])
                          ], 512), [
                            [an, Et.value]
                          ])
                        ]),
                        _: 1
                      })
                    ], 32),
                    n.value.isSending ? (p(), g("button", {
                      key: 1,
                      type: "button",
                      class: "oxc-stop-response",
                      "data-composer-action": "stop",
                      title: _.value ? "停止回复" : "Stop response",
                      "aria-label": _.value ? "停止回复" : "Stop response",
                      onClick: bc
                    }, [...l[109] || (l[109] = [
                      o("i", {
                        class: "fa-solid fa-stop",
                        "aria-hidden": "true"
                      }, null, -1)
                    ])], 8, Rw)) : x("", !0),
                    o("button", {
                      type: "button",
                      class: "oxc-send-btn",
                      title: n.value.isSending ? _.value ? "发送引导" : "Send guidance" : _.value ? "发送" : "Send",
                      "aria-label": n.value.isSending ? _.value ? "发送引导" : "Send guidance" : _.value ? "发送" : "Send",
                      disabled: !n.value.canUseHost || ce.value || Oe.value.pending || a.value || r.value.sending || !String(i.value || "").trim() && !sn.value.length || n.value.isSending && (!!sn.value.length || r.value.supported === !1),
                      onClick: aa
                    }, [
                      o("i", {
                        class: se(a.value || r.value.sending ? "fa-solid fa-spinner fa-spin" : n.value.isSending ? "fa-solid fa-arrow-turn-up" : Kc.value)
                      }, null, 2)
                    ], 8, Nw)
                  ])
                ])
              ]),
              o("div", Lw, [
                o("span", Ow, u(n.value.isSending ? _.value ? "Enter 引导 · 当前回复继续" : "Enter to guide · Reply continues" : _.value ? "Enter 发送 · Shift + Enter 换行" : "Enter to send · Shift + Enter for a new line"), 1),
                He.value.git && He.value.git.enabled ? (p(), g("div", {
                  key: 0,
                  class: "oxc-git-shell",
                  onMousedown: l[33] || (l[33] = Re(() => {
                  }, ["stop"])),
                  onClick: l[34] || (l[34] = Re(() => {
                  }, ["stop"]))
                }, [
                  o("button", {
                    type: "button",
                    class: "oxc-context-chip is-git",
                    disabled: !He.value.git.canSwitch || Nn.value,
                    onClick: vu,
                    title: He.value.git.canSwitch ? _.value ? "切换 Git 分支" : "Switch Git branch" : _.value ? "当前 Git 分支（只读）" : "Current Git branch (read-only)"
                  }, [
                    l[110] || (l[110] = o("i", { class: "fa-solid fa-code-branch" }, null, -1)),
                    o("span", null, u(He.value.git.branch), 1),
                    He.value.git.dirty ? (p(), g("span", Fw, "●")) : x("", !0),
                    He.value.git.canSwitch ? (p(), g("i", qw)) : x("", !0)
                  ], 8, Dw),
                  Ke(It, { name: "oxc-pop" }, {
                    default: wt(() => [
                      Rt(o("div", jw, [
                        o("div", Zw, [
                          o("strong", null, u(_.value ? "Git 分支" : "Git Branches"), 1),
                          He.value.git.ahead || He.value.git.behind ? (p(), g("small", Hw, " ↑" + u(He.value.git.ahead) + " ↓" + u(He.value.git.behind), 1)) : x("", !0)
                        ]),
                        (p(!0), g(ye, null, Te(He.value.git.branches.length ? He.value.git.branches : [He.value.git.branch], (v) => (p(), g("button", {
                          key: `git-${v}`,
                          type: "button",
                          class: se(["oxc-popover__option", { "is-active": v === He.value.git.branch }]),
                          disabled: Nn.value,
                          onClick: (O) => pu(v)
                        }, [
                          l[111] || (l[111] = o("i", { class: "fa-solid fa-code-branch" }, null, -1)),
                          o("div", Vw, [
                            o("strong", null, u(v), 1)
                          ]),
                          v === He.value.git.branch ? (p(), g("i", Uw)) : x("", !0)
                        ], 10, Bw))), 128))
                      ], 512), [
                        [an, Rn.value && He.value.git.canSwitch]
                      ])
                    ]),
                    _: 1
                  })
                ], 32)) : x("", !0)
              ])
            ], 512)
          ], 4)
        ]),
        oe.value?.kind === "file" && ia.value.length ? (p(), Lt(Rm, {
          key: 3,
          tabs: ia.value,
          "active-key": _e.value,
          "is-zh": _.value,
          bridge: Qe(t),
          onSelect: oa,
          onCloseTab: fc,
          onClose: tn
        }, null, 8, ["tabs", "active-key", "is-zh", "bridge"])) : b.value ? (p(), Lt(oy, {
          key: Qe(gt)(n.value) + b.value,
          task: Ze.value,
          "is-zh": _.value,
          bridge: Qe(t),
          "can-manage": ne.value.canManage,
          "can-open-center": ne.value.canOpenCenter,
          "refresh-error": ne.value.error,
          loading: ne.value.loading,
          onClose: l[35] || (l[35] = (v) => b.value = ""),
          onChanged: lc,
          onRefresh: l[36] || (l[36] = (v) => Ni(!0))
        }, null, 8, ["task", "is-zh", "bridge", "can-manage", "can-open-center", "refresh-error", "loading"])) : L.value ? (p(), Lt(Jg, {
          key: 5,
          message: L.value,
          selection: oe.value,
          "is-zh": _.value,
          "load-subagent-transcript": ac,
          onClose: tn
        }, null, 8, ["message", "selection", "is-zh"])) : x("", !0),
        o("button", {
          type: "button",
          class: se(["oxc-settings-toggle", { "is-active": w.value }]),
          title: w.value ? _.value ? "收起设置" : "Hide settings" : _.value ? "打开设置" : "Open settings",
          onClick: la
        }, [
          o("i", {
            class: se(w.value ? "fa-solid fa-chevron-right" : "fa-solid fa-chevron-left")
          }, null, 2)
        ], 10, Ww),
        w.value ? (p(), g("aside", {
          key: 6,
          class: se(["oxc-settings-panel", { "is-open": w.value }])
        }, [
          o("div", Kw, [
            o("span", zw, u(_.value ? "对话设置" : "Chat settings"), 1),
            o("button", {
              type: "button",
              class: "oxc-settings-panel__close",
              onClick: ca,
              title: _.value ? "关闭" : "Close"
            }, [...l[112] || (l[112] = [
              o("i", { class: "fa-solid fa-xmark" }, null, -1)
            ])], 8, Gw)
          ]),
          o("div", Qw, [
            o("div", Jw, [
              o("label", Xw, u(_.value ? "模型选择" : "Model"), 1),
              o("div", Yw, [
                o("div", ek, [
                  te.value.providerLogo ? (p(), g("img", {
                    key: 0,
                    src: te.value.providerLogo,
                    alt: te.value.providerName,
                    class: "oxc-model-summary__logo"
                  }, null, 8, tk)) : (p(), g("span", nk, [...l[113] || (l[113] = [
                    o("i", { class: "fa-solid fa-microchip" }, null, -1)
                  ])])),
                  o("div", ik, [
                    o("strong", null, u(te.value.providerName), 1),
                    o("span", null, u(te.value.providerSummary || (_.value ? "当前用于实时会话的模型服务商" : "The provider currently used for live chat")), 1)
                  ])
                ]),
                o("div", sk, [
                  o("div", ok, u(te.value.model), 1),
                  we.value && !we.value.isTemplate ? (p(), g("button", {
                    key: 0,
                    type: "button",
                    class: "oxc-provider-validate-btn",
                    disabled: we.value.isValidating,
                    onClick: l[37] || (l[37] = (v) => $c(we.value.id))
                  }, [
                    o("i", {
                      class: se(we.value.isValidating ? "fa-solid fa-spinner fa-spin" : "fa-solid fa-vial-circle-check")
                    }, null, 2),
                    o("span", null, u(we.value.isValidating ? _.value ? "验证中" : "Validating" : _.value ? "验证" : "Validate"), 1)
                  ], 8, ak)) : x("", !0)
                ])
              ]),
              o("button", {
                type: "button",
                class: "oxc-model-button",
                onClick: Ac
              }, [
                o("span", rk, [
                  l[114] || (l[114] = o("i", { class: "fa-solid fa-sliders" }, null, -1)),
                  o("span", null, u(_.value ? "打开完整模型配置" : "Open full model config"), 1)
                ]),
                l[115] || (l[115] = o("i", { class: "fa-solid fa-arrow-up-right-from-square oxc-model-button__arrow" }, null, -1))
              ]),
              Li.value.length ? (p(), g("div", lk, [
                o("div", ck, [
                  o("span", null, u(_.value ? "可用服务商" : "Available providers"), 1),
                  o("small", null, u(te.value.configuredProviderCount) + " " + u(_.value ? "个已配置" : "configured"), 1)
                ]),
                o("div", uk, [
                  (p(!0), g(ye, null, Te(Li.value, (v) => (p(), g("button", {
                    key: v.id,
                    type: "button",
                    class: se(["oxc-provider-card", { "is-active": v.isActive, "is-template": v.isTemplate }]),
                    onClick: (O) => Ic(v)
                  }, [
                    o("div", fk, [
                      o("div", vk, [
                        v.logo ? (p(), g("img", {
                          key: 0,
                          src: v.logo,
                          alt: v.name,
                          class: "oxc-provider-card__logo"
                        }, null, 8, pk)) : (p(), g("span", hk, [...l[116] || (l[116] = [
                          o("i", { class: "fa-solid fa-microchip" }, null, -1)
                        ])])),
                        o("div", gk, [
                          o("strong", null, u(v.name), 1),
                          o("small", null, u(v.validationStatus ? Ns(v) : v.statusLabel), 1)
                        ])
                      ]),
                      v.isActive ? (p(), g("span", mk, u(_.value ? "当前" : "Current"), 1)) : v.isTemplate ? (p(), g("span", yk, u(_.value ? "模板" : "Template"), 1)) : x("", !0)
                    ]),
                    o("div", bk, u(v.modelId || (_.value ? "未设置默认模型" : "No default model")), 1),
                    o("div", _k, u(v.summary || (v.isTemplate ? _.value ? "点击进入配置" : "Open setup" : _.value ? "点击切换到该服务商" : "Switch this provider into the live chat runtime")), 1),
                    v.validationMessage ? (p(), g("div", wk, u(v.validationMessage), 1)) : x("", !0)
                  ], 10, dk))), 128))
                ]),
                we.value && !we.value.isTemplate && (we.value.validationStatus || we.value.validationMessage || we.value.validationModels && we.value.validationModels.length) ? (p(), g("div", kk, [
                  o("div", xk, [
                    o("span", null, u(_.value ? "当前服务商诊断" : "Current provider diagnostics"), 1),
                    o("small", null, u(Ns(we.value)), 1)
                  ]),
                  we.value.validationMessage ? (p(), g("div", Sk, u(we.value.validationMessage), 1)) : x("", !0),
                  we.value.validationModels && we.value.validationModels.length ? (p(), g("div", Ck, [
                    (p(!0), g(ye, null, Te(we.value.validationModels, (v) => (p(), g("button", {
                      key: `${we.value.id}-validated-${v.value}`,
                      type: "button",
                      class: se(["oxc-provider-model-chip", { "is-active": te.value.model === v.value }]),
                      onClick: (O) => Cs(we.value.id, v.value)
                    }, u(v.label), 11, Ak))), 128))
                  ])) : x("", !0)
                ])) : x("", !0),
                we.value && we.value.models && we.value.models.length ? (p(), g("div", Ik, [
                  we.value.validationStatus || we.value.validationMessage || we.value.validationChecks && we.value.validationChecks.length || we.value.validationModels && we.value.validationModels.length ? (p(), g("div", $k, [
                    o("div", Mk, [
                      o("span", null, u(_.value ? "当前服务商诊断" : "Current provider diagnostics"), 1),
                      o("small", null, u(Ns(we.value)), 1)
                    ]),
                    o("div", Tk, [
                      o("span", {
                        class: se(["oxc-provider-diagnostics__chip", { "is-on": we.value.apiKeyConfigured || we.value.apiKeyOptional }])
                      }, [
                        l[117] || (l[117] = o("i", { class: "fa-solid fa-key" }, null, -1)),
                        o("span", null, u(we.value.apiKeyConfigured || we.value.apiKeyOptional ? _.value ? "API Key 已就绪" : "API key ready" : _.value ? "API Key 缺失" : "API key missing"), 1)
                      ], 2),
                      o("span", {
                        class: se(["oxc-provider-diagnostics__chip", { "is-on": we.value.matchedModel }])
                      }, [
                        l[118] || (l[118] = o("i", { class: "fa-solid fa-circle-nodes" }, null, -1)),
                        o("span", null, u(we.value.matchedModel ? _.value ? "模型已匹配" : "Model matched" : _.value ? "模型待确认" : "Model unresolved"), 1)
                      ], 2)
                    ]),
                    we.value.validationMessage ? (p(), g("div", Pk, u(we.value.validationMessage), 1)) : x("", !0),
                    we.value.validationChecks && we.value.validationChecks.length ? (p(), g("div", Ek, [
                      (p(!0), g(ye, null, Te(we.value.validationChecks, (v, O) => (p(), g("div", {
                        key: `${we.value.id}-check-${O}`,
                        class: "oxc-provider-check"
                      }, [
                        o("strong", null, u(v.label || v.name || v.id || (_.value ? "检查项" : "Check")), 1),
                        o("span", null, u(v.message || v.detail || v.status || ""), 1)
                      ]))), 128))
                    ])) : x("", !0),
                    we.value.validationModels && we.value.validationModels.length ? (p(), g("div", Rk, [
                      (p(!0), g(ye, null, Te(we.value.validationModels, (v) => (p(), g("button", {
                        key: `${we.value.id}-validated-${v.value}`,
                        type: "button",
                        class: se(["oxc-provider-model-chip", { "is-active": te.value.model === v.value }]),
                        onClick: (O) => Cs(we.value.id, v.value)
                      }, u(v.label), 11, Nk))), 128))
                    ])) : x("", !0)
                  ])) : x("", !0),
                  o("div", Lk, [
                    o("span", null, u(_.value ? "当前服务商模型" : "Models in current provider"), 1)
                  ]),
                  o("div", Ok, [
                    (p(!0), g(ye, null, Te(we.value.models, (v) => (p(), g("button", {
                      key: `${we.value.id}-${v.value}`,
                      type: "button",
                      class: se(["oxc-provider-model-chip", { "is-active": te.value.model === v.value }]),
                      onClick: (O) => Cs(we.value.id, v.value)
                    }, u(v.label), 11, Dk))), 128))
                  ])
                ])) : x("", !0)
              ])) : x("", !0),
              o("span", Fk, u(_.value ? "在这里直接切换当前实时会话的服务商和默认模型；需要补 API 地址或 Key 时，再打开完整配置。" : "Switch the active provider and default model here. Open the full model config only when you need to edit endpoints or API keys."), 1)
            ]),
            o("div", qk, [
              o("label", jk, u(_.value ? "温度 (Temperature)" : "Temperature"), 1),
              o("div", Zk, [
                o("input", {
                  type: "range",
                  min: "0",
                  max: "2",
                  step: "0.1",
                  value: te.value.temperature,
                  onInput: Bc
                }, null, 40, Hk),
                o("span", Bk, u(Su.value), 1)
              ]),
              o("span", Vk, u(_.value ? "较低更精确，较高更有创意" : "Lower = focused, higher = creative"), 1)
            ]),
            o("div", Uk, [
              o("label", Wk, u(_.value ? "最大输出长度" : "Max output tokens"), 1),
              o("select", {
                class: "oxc-select",
                value: te.value.maxTokens,
                onChange: Vc
              }, [
                (p(!0), g(ye, null, Te(te.value.maxTokensOptions || [], (v) => (p(), g("option", {
                  key: v,
                  value: v
                }, u(v.toLocaleString()) + " tokens ", 9, zk))), 128))
              ], 40, Kk)
            ]),
            o("div", Gk, [
              o("label", Qk, u(_.value ? "系统提示词" : "System prompt"), 1),
              o("textarea", {
                class: "oxc-textarea",
                value: te.value.systemPrompt,
                placeholder: _.value ? "设定 AI 的角色和行为规则..." : "Define the AI role and behavior rules...",
                onInput: Uc
              }, null, 40, Jk)
            ]),
            te.value.completionPreferencesAvailable ? (p(), g("div", Xk, [
              o("div", Yk, [
                o("label", ex, u(_.value ? "完成提醒" : "Completion alerts"), 1),
                o("label", tx, [
                  o("input", {
                    type: "checkbox",
                    "data-completion-preference": "completionNotificationsEnabled",
                    "aria-label": _.value ? "完成提醒" : "Completion alerts",
                    checked: te.value.completionNotificationsEnabled,
                    disabled: K.value,
                    onChange: l[38] || (l[38] = (v) => ta("completionNotificationsEnabled", v))
                  }, null, 40, nx),
                  l[119] || (l[119] = o("span", { class: "oxc-toggle__slider" }, null, -1))
                ])
              ]),
              o("span", ix, u(_.value ? "回复或任务实际结束后提醒；点击通知回到原会话。" : "Notify when a reply or task actually finishes; click to return to its conversation."), 1),
              o("div", sx, [
                o("label", ox, u(_.value ? "提醒声音" : "Alert sound"), 1),
                o("label", ax, [
                  o("input", {
                    type: "checkbox",
                    "data-completion-preference": "completionNotificationSound",
                    "aria-label": _.value ? "提醒声音" : "Alert sound",
                    checked: te.value.completionNotificationSound,
                    disabled: K.value || !te.value.completionNotificationsEnabled,
                    onChange: l[39] || (l[39] = (v) => ta("completionNotificationSound", v))
                  }, null, 40, rx),
                  l[120] || (l[120] = o("span", { class: "oxc-toggle__slider" }, null, -1))
                ])
              ]),
              le.value ? (p(), g("p", lx, u(le.value), 1)) : x("", !0)
            ])) : x("", !0),
            te.value.memoryAvailable ? (p(), g("div", cx, [
              o("div", ux, [
                o("label", dx, u(_.value ? "角色记忆" : "Role memory"), 1),
                o("label", fx, [
                  o("input", {
                    type: "checkbox",
                    checked: te.value.memoryEnabled,
                    onChange: pa
                  }, null, 40, vx),
                  l[121] || (l[121] = o("span", { class: "oxc-toggle__slider" }, null, -1))
                ])
              ]),
              o("span", px, u(_.value ? "使用所选角色的设定与角色记忆" : "Use the selected role profile and its role memory"), 1)
            ])) : x("", !0),
            te.value.nativeMemoryAvailable ? (p(), g("div", hx, [
              o("div", gx, [
                o("label", mx, u(_.value ? "原生记忆 Memory V3" : "Native memory · Memory V3"), 1),
                o("label", yx, [
                  o("input", {
                    type: "checkbox",
                    checked: te.value.nativeMemoryEnabled,
                    onChange: ha
                  }, null, 40, bx),
                  l[122] || (l[122] = o("span", { class: "oxc-toggle__slider" }, null, -1))
                ])
              ]),
              o("span", _x, u(_.value ? "按本轮问题检索；注入结果可在回复的记忆来源中查看" : "Recall for the current query; inspect injection receipts on the reply"), 1)
            ])) : x("", !0),
            o("div", wx, [
              o("div", kx, [
                o("label", xx, u(_.value ? "代码解释器" : "Code interpreter"), 1),
                o("label", Sx, [
                  o("input", {
                    type: "checkbox",
                    checked: te.value.interpreterEnabled,
                    onChange: va
                  }, null, 40, Cx),
                  l[123] || (l[123] = o("span", { class: "oxc-toggle__slider" }, null, -1))
                ])
              ]),
              o("span", Ax, u(_.value ? "允许 AI 在沙箱中执行代码" : "Lets the assistant execute code in a sandbox"), 1)
            ])
          ])
        ], 2)) : x("", !0),
        w.value ? (p(), g("div", {
          key: 7,
          class: "oxc-settings-backdrop",
          onClick: ca
        })) : x("", !0)
      ], 2));
    }
  };
  function bo() {
    const e = document.getElementById("openxnet-vite-chat-root");
    !e || e.dataset.viteMounted === "true" || (iv(Tx).mount(e), e.dataset.viteMounted = "true");
  }
  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", bo, { once: !0 }) : bo();
  window.addEventListener("openxnet-vite-chat-remount", bo);
});
export default Px();
