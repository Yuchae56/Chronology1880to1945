const END = 1946,
  PAD = 24,
  LH = 28,
  TOP = 15;
// 멀리서 볼 때(한 해가 46px보다 좁을 때, 5년·10년 단위)는 촘촘 모드: 작은 칸, 좁은 줄 간격, 긴 이름 줄임
const COMPACT_PPY = 46,
  LH_COMPACT = 21,
  COMPACT_NAME_MAX = 64; // style.css의 #body.compact .ev .nm max-width와 맞춤
const MINP = 16,
  MAXP = 1400;
let ppy = 130 * 1.5 ** 3; // 처음 배율: 130에서 + 단추를 세 번 누른 값
const hidden = new Set();
const hiddenSrc = new Set(); // 'd' 연도 기재 | 's' 연도 보충

const vp = document.getElementById("vp"),
  inner = document.getElementById("inner"),
  axis = document.getElementById("axis"),
  body = document.getElementById("body"),
  tip = document.getElementById("tip"),
  slider = document.getElementById("zslider"),
  zlabel = document.getElementById("zlabel");

// ===== 항목 =====
const fmt = (y, m) => y + "년" + (m ? " " + m + "월" : "");
const EV = [];
const N_EXTRA = ITEMS.filter((it) =>
  String(it[9]).startsWith("색인 추가"),
).length;
const frag = document.createDocumentFragment();
function makeEvEl(className, url, color, name) {
  const el = document.createElement(url ? "a" : "div");
  el.className = className;
  if (url) {
    el.href = url;
    el.target = "_blank";
    el.rel = "noopener";
    el.draggable = false;
  }
  el.style.setProperty("--c", color);
  el.innerHTML = `<span class="dot"></span><span class="nm"></span>`;
  el.lastChild.textContent = name;
  return el;
}
ITEMS.forEach(
  ([ci, name, y, m, ey, em, fz, ylab, lab, note, kind, url, ix]) => {
    const color = CATS[ci][1];
    const sup = kind > 0;
    const el = makeEvEl("ev" + (sup ? " sup" : ""), url, color, name);
    const st =ylab ? ylab + "년" + (m ? " " + m + "월" : "") : fmt(y, m);
    const when = lab
      ? lab
      : ey
        ? `${st} ~ ${fmt(ey, em)}`
        : fz === "open"
          ? st + " 이후"
          : st;
    // 근거 메모는 CSV에만 남기고, 말풍선에는 책의 색인 추가 설명만 보임
    const noteParts = note
      .split(" | ")
      .filter((part) => part.startsWith("색인 추가 항목"));
    const shownNote = noteParts.join(" | ");
    el.dataset.tip =
      `${CATS[ci][0]}, ${when}` + (shownNote ? ` (${shownNote})` : "");
    frag.appendChild(el);
    EV.push({
      name,
      y,
      m,
      ey,
      em,
      fz,
      c: ci,
      el,
      w: 0,
      src: sup ? "s" : "d",
      x: -1,
      t: -1,
      vis: true,
      ix: !!ix,
      isEnd: false,
    });
    // 끝 연도가 있으면 끝 연도 자리에 '이름 ✕' 항목을 하나 더 세움 (연표 범위 밖의 끝 연도는 그리지 않음)
    if (ey && ey < END) {
      const endEl = makeEvEl("ev endmark" + (sup ? " sup" : ""), url, color, name);
      endEl.dataset.tip = `${CATS[ci][0]}, ${fmt(ey, em)}에 끝남 (${when})`;
      frag.appendChild(endEl);
      EV.push({
        name,
        y: ey,
        m: em,
        ey: 0,
        em: 0,
        fz: "",
        c: ci,
        el: endEl,
        w: 0,
        src: sup ? "s" : "d",
        x: -1,
        t: -1,
        vis: true,
        ix: !!ix,
        isEnd: true,
      });
    }
  },
);
body.appendChild(frag);
// 개수 세기와 검색은 시작 항목만 대상으로 함
const EV_MAIN = EV.filter((e) => !e.isEnd);

// ===== 축과 격자 (한 번만 만들고 위치만 갱신) =====
const YL = [],
  ML = [],
  GL = [],
  GM = [];
(function buildAxis() {
  const fa = document.createDocumentFragment(),
    fb = document.createDocumentFragment();
  for (let y = START; y < END; y++) {
    const d = document.createElement("div");
    d.className = "yl" + (y % 5 === 0 ? " major" : "");
    d.textContent = y;
    fa.appendChild(d);
    YL.push([y, d]);
    const g = document.createElement("div");
    g.className = "gl" + (y % 5 === 0 ? " major" : "");
    fb.appendChild(g);
    GL.push([y, g]);
    for (let m = 2; m <= 12; m++) {
      const mg = document.createElement("div");
      mg.className = "gl mo";
      fb.appendChild(mg);
      GM.push([y + (m - 1) / 12, mg]);
    }
    for (let m = 1; m <= 12; m++) {
      const ml = document.createElement("div");
      ml.className = "ml";
      ml.textContent = m + "월";
      fa.appendChild(ml);
      ML.push([y + (m - 1) / 12, ml]);
    }
  }
  axis.appendChild(fa);
  body.insertBefore(fb, body.firstChild);
})();

// ===== 범례 =====
const legend = document.getElementById("legend");
const chips = [];
let col = null,
  prevFam = null;
CATS.forEach(([cat, color, fam], ci) => {
  if (fam !== prevFam) {
    col = document.createElement("section");
    col.className = "sidesec";
    col.innerHTML = `<h3>${fam}</h3>`;
    legend.appendChild(col);
    prevFam = fam;
  }
  const n = EV_MAIN.filter((e) => e.c === ci).length;
  const b = document.createElement("button");
  b.className = "cat";
  b.style.setProperty("--c", color);
  b.innerHTML = `<span class="sw"></span><span class="lb">${cat}</span><span class="n">${n}</span>`;
  b.title = `${cat}\n누르면 켜고 끕니다. 두 번 누르면 이 분류만 남깁니다.`;
  let clickTimer = null;
  b.addEventListener("click", () => {
    clearTimeout(clickTimer);
    clickTimer = setTimeout(() => {
      hidden.has(ci) ? hidden.delete(ci) : hidden.add(ci);
      syncChips();
      schedule();
    }, 220);
  });
  b.addEventListener("dblclick", () => {
    clearTimeout(clickTimer);
    hidden.clear();
    CATS.forEach((_, j) => {
      if (j !== ci) hidden.add(j);
    });
    syncChips();
    schedule();
  });
  col.appendChild(b);
  chips.push(b);
});
const ctl = document.getElementById("sidectl");
const allOn = document.createElement("button");
allOn.className = "sidelink";
allOn.textContent = "모두 켜기";
allOn.onclick = () => {
  hidden.clear();
  syncChips();
  schedule();
};
const allOff = document.createElement("button");
allOff.className = "sidelink";
allOff.textContent = "모두 끄기";
allOff.onclick = () => {
  CATS.forEach((_, j) => hidden.add(j));
  syncChips();
  schedule();
};
ctl.append(allOn, allOff);

// ===== 보기 설정 (체크 상자) =====
const opts = document.getElementById("opts"),
  countEl = document.getElementById("count");
function addOpt(html, title, onchange) {
  const l = document.createElement("label");
  l.innerHTML = `<input type="checkbox">${html}`;
  if (title) l.title = title;
  const i = l.querySelector("input");
  i.addEventListener("change", () => {
    onchange(i.checked);
    syncChips();
    schedule();
  });
  opts.appendChild(l);
  return i;
}
const srcChips = {
  d: addOpt(
    `표에 연도가 있는 항목 <span class="n">${EV_MAIN.filter((e) => e.src === "d").length}</span>`,
    "",
    (v) => (v ? hiddenSrc.delete("d") : hiddenSrc.add("d")),
  ),
  s: addOpt(
    `<span class="supx">연도를 보충한 항목</span> <span class="n">${EV_MAIN.filter((e) => e.src === "s").length}</span>`,
    "표에 연도가 없어 책 비고나 백과사전에서 연도를 찾은 항목",
    (v) => (v ? hiddenSrc.delete("s") : hiddenSrc.add("s")),
  ),
};
let idxOnly = false;
try {
  idxOnly = localStorage.getItem("tl-idx") === "1";
} catch (e) {}
const nIdx = EV_MAIN.filter((e) => e.ix).length;
const idxChip = addOpt(
  `책 색인 항목만 <span class="n">${nIdx}</span>`,
  "책 색인에 실리지 않은 항목을 숨깁니다",
  (v) => {
    idxOnly = v;
    try {
      localStorage.setItem("tl-idx", v ? "1" : "0");
    } catch (e) {}
  },
);
function syncChips() {
  idxChip.checked = idxOnly;
  chips.forEach((b, i) => {
    b.classList.toggle("off", hidden.has(i));
    b.setAttribute("aria-pressed", String(!hidden.has(i)));
  });
  Object.entries(srcChips).forEach(([k, i]) => {
    i.checked = !hiddenSrc.has(k);
  });
}

syncChips();

// ===== 연표에 넣지 못한 항목 =====
const up = document.getElementById("unplaced"),
  upbtn = document.getElementById("upbtn");
upbtn.innerHTML = `<span>연도 미상</span><span class="n">${UNPLACED.length}</span>`;
upbtn.title = "연도를 찾지 못해 연표에 넣지 못한 항목";
(function () {
  let h = `<h2>연도를 찾지 못해 연표에 넣지 못한 항목 ${UNPLACED.length}건</h2><p>표에 연도가 없고, 책 비고와 백과사전에서도 시점을 아직 확인하지 못한 항목입니다.</p>`;
  CATS.forEach(([cat, color], ci) => {
    const ns = UNPLACED.filter((u) => u[0] === ci).map((u) => u[1]);
    if (ns.length)
      h += `<div class="grp"><div class="gname"><i style="background:${color}"></i>${cat} ${ns.length}</div><div class="names">${ns.join(", ")}</div></div>`;
  });
  up.innerHTML = h;
})();

function closeUnplaced() {
  up.classList.remove("open");
  upbtn.setAttribute("aria-expanded", "false");
}
upbtn.addEventListener("click", (e) => {
  e.stopPropagation();
  const isOpen = up.classList.toggle("open");
  upbtn.setAttribute("aria-expanded", String(isOpen));
});
document.addEventListener("click", (e) => {
  if (!up.contains(e.target)) closeUnplaced();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeUnplaced();
});

// ===== 배치 =====
function measure() {
  const ctx = document.createElement("canvas").getContext("2d");
  const ff = getComputedStyle(document.body).fontFamily;
  EV.forEach((e) => {
    // 글자 폭 + 점 6 + 점 오른쪽 5 + 왼쪽 여백 6 + 오른쪽 여백 7 + 여유 2 (style.css의 .ev와 맞춤)
    ctx.font = `500 13px ${ff}`;
    e.w = Math.ceil(ctx.measureText(e.name).width + 6 + 5 + 6 + 7 + 2);
    // 촘촘 모드: 이름(최대 COMPACT_NAME_MAX) + 점 5 + 점 오른쪽 4 + 왼쪽 여백 4 + 오른쪽 여백 5 + 여유 2
    ctx.font = `500 11px ${ff}`;
    const small = Math.min(ctx.measureText(e.name).width, COMPACT_NAME_MAX);
    e.wc = Math.ceil(small + 5 + 4 + 4 + 5 + 2);
  });
}
const xOf = (y, m) =>
  PAD + (y - START) * ppy + (m ? ((m - 1 + 0.5) / 12) * ppy : 5);

let lastMonths = null,
  lastStep = 0,
  lastH = 0,
  innerW = 0,
  isCompact = false;
function render(range) {
  const fast = !!range,
    lo = fast ? range[0] : -1e9,
    hi = fast ? range[1] : 1e9;
  const W = Math.ceil((END - START) * ppy + PAD * 2);
  // 폭 변경은 전체 레이아웃을 다시 계산하므로, 확대 중에는 여유를 두고 드물게만 바꿈
  if (!fast) {
    if (W !== innerW) {
      inner.style.width = W + "px";
      innerW = W;
    }
  } else if (W > innerW || W < innerW / 2) {
    innerW = Math.ceil(W * 1.5);
    inner.style.width = innerW + "px";
  }

  // 축
  const step = ppy >= 46 ? 1 : ppy >= 22 ? 5 : 10;
  const months = ppy >= 400,
    mgrid = ppy >= 160;
  YL.forEach(([y, d]) => {
    const show = (y - START) % step === 0;
    if (step !== lastStep) d.style.display = show ? "" : "none";
    const x = PAD + (y - START) * ppy;
    if (show && x > lo - 60 && x < hi)
      d.style.transform = `translateX(${x}px)`;
  });
  lastStep = step;
  if (months !== lastMonths) {
    axis.classList.toggle("months", months);
    lastMonths = months;
  }
  if (months)
    ML.forEach(([t, d]) => {
      const x = PAD + (t - START) * ppy;
      if (x > lo - 60 && x < hi) d.style.transform = `translateX(${x}px)`;
    });
  body.classList.toggle("months", mgrid);
  GL.forEach(([y, g]) => {
    const x = PAD + (y - START) * ppy;
    if (x > lo && x < hi) g.style.transform = `translateX(${x}px)`;
  });
  if (mgrid)
    GM.forEach(([t, g]) => {
      const x = PAD + (t - START) * ppy;
      if (x > lo && x < hi) g.style.transform = `translateX(${x}px)`;
    });

  // 촘촘 모드는 줄을 다시 배정하는 전체 배치 때만 바꿈 (확대 도중에는 그대로 둠)
  if (!fast) {
    isCompact = ppy < COMPACT_PPY;
    body.classList.toggle("compact", isCompact);
  }
  const lh = isCompact ? LH_COMPACT : LH;

  // 항목 배치 (겹치지 않게 줄 배정)
  const vis = [];
  for (const e of EV) {
    const show = !(
      hidden.has(e.c) ||
      hiddenSrc.has(e.src) ||
      (idxOnly && !e.ix)
    );
    if (show !== e.vis) {
      e.el.style.display = show ? "" : "none";
      e.vis = show;
    }
    if (!show) continue;
    const xs = xOf(e.y, e.m);
    e.nx = xs - 8;
    e.span = isCompact ? e.wc : e.w;
    if (fast) {
      if (e.t >= 0 && e.nx + e.span > lo && e.nx < hi && e.nx !== e.x) {
        e.el.style.transform = `translate(${e.nx}px,${e.t}px)`;
        e.x = e.nx;
      }
      continue;
    }
    vis.push(e);
  }
  if (fast) {
    slider.value = Math.round(
      (Math.log(ppy / MINP) / Math.log(MAXP / MINP)) * 1000,
    );
    return;
  }
  vis.sort((a, b) => a.nx - b.nx || a.c - b.c);
  const lanes = [];
  for (const e of vis) {
    let i = 0;
    while (i < lanes.length && lanes[i] > e.nx) i++;
    if (i === lanes.length) lanes.push(0);
    lanes[i] = e.nx + e.span + 4;
    const ty = TOP + i * lh;
    if (e.nx !== e.x || ty !== e.t) {
      e.el.style.transform = `translate(${e.nx}px,${ty}px)`;
      e.x = e.nx;
      e.t = ty;
    }
  }
  const h = Math.max(TOP + lanes.length * lh + 40, vp.clientHeight - 54);
  if (h !== lastH) {
    body.style.height = h + "px";
    lastH = h;
  }

  const shownMain = vis.filter((e) => !e.isEnd).length;
  countEl.textContent =
    shownMain < EV_MAIN.length
      ? `${EV_MAIN.length}건 중 ${shownMain}건 표시`
      : "";
  slider.value = Math.round(
    (Math.log(ppy / MINP) / Math.log(MAXP / MINP)) * 1000,
  );
  zlabel.textContent = months
    ? "월 단위"
    : ppy >= 46
      ? "연 단위"
      : "5년 단위";
}

// 한 프레임에 한 번만 다시 그림
let pending = false,
  zoomReq = null;
function schedule() {
  if (!pending) {
    pending = true;
    requestAnimationFrame(frame);
  }
}
function frame() {
  pending = false;
  if (zoomReq) {
    const { np, ax } = zoomReq;
    zoomReq = null;
    const yearAt = (vp.scrollLeft + ax - PAD) / ppy;
    ppy = np;
    const sl = Math.max(0, yearAt * ppy + PAD - ax);
    render([sl - vp.clientWidth * 0.5, sl + vp.clientWidth * 1.5]);
    stopSmooth();
    vp.scrollLeft = sl;
    smooth.target = vp.scrollLeft;
    clearTimeout(settleTimer);
    settleTimer = setTimeout(settle, pinch ? 400 : 140);
  } else render();
}
let settleTimer = 0;
function settle() {
  clearTimeout(settleTimer);
  if (pinch) {
    settleTimer = setTimeout(settle, 200);
    return;
  }
  render();
}
let vpLeft = vp.getBoundingClientRect().left;
function zoomTo(np, anchorClientX) {
  np = Math.max(MINP, Math.min(MAXP, np));
  const ax =
    anchorClientX == null ? vp.clientWidth / 2 : anchorClientX - vpLeft;
  if (zoomReq) zoomReq.np = np;
  else zoomReq = { np, ax };
  if (anchorClientX != null) zoomReq.ax = ax;
  schedule();
}
const curP = () => (zoomReq ? zoomReq.np : ppy);
document.getElementById("zin").onclick = () => zoomTo(curP() * 1.5);
document.getElementById("zout").onclick = () => zoomTo(curP() / 1.5);
document.getElementById("zfit").onclick = () => {
  zoomTo((vp.clientWidth - PAD * 2) / (END - START));
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      vp.scrollLeft = 0;
      smooth.target = 0;
    }),
  );
};
slider.addEventListener("input", () =>
  zoomTo(MINP * Math.pow(MAXP / MINP, slider.value / 1000)),
);
// 터치 기기: 두 손가락으로 벌리고 오므려 확대, 축소
let pinch = null;
const tdist = (t) =>
  Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY) ||
  1;
vp.addEventListener(
  "touchstart",
  (e) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      stopSmooth();
      pinch = { d0: tdist(e.touches), p0: curP() };
    }
  },
  { passive: false },
);
vp.addEventListener(
  "touchmove",
  (e) => {
    if (!pinch || e.touches.length !== 2) return;
    e.preventDefault();
    const mid = (e.touches[0].clientX + e.touches[1].clientX) / 2;
    vpLeft = vp.getBoundingClientRect().left;
    zoomTo((pinch.p0 * tdist(e.touches)) / pinch.d0, mid);
  },
  { passive: false },
);
vp.addEventListener("touchend", (e) => {
  if (pinch && e.touches.length < 2) {
    pinch = null;
    requestAnimationFrame(settle);
  }
});
vp.addEventListener("touchcancel", () => {
  if (pinch) {
    pinch = null;
    requestAnimationFrame(settle);
  }
});
// iOS Safari가 화면 전체를 확대하지 않도록 막음
["gesturestart", "gesturechange"].forEach((t) =>
  document.addEventListener(t, (e) => e.preventDefault(), {
    passive: false,
  }),
);
// Mac Safari 트랙패드: 두 손가락으로 벌리고 오므려 확대, 축소
// iOS에서는 위의 터치 확대가 이미 처리하므로 그때는 넘어감
let gesture = null;
vp.addEventListener("gesturestart", (e) => {
  if (pinch) return;
  stopSmooth();
  vpLeft = vp.getBoundingClientRect().left;
  gesture = { p0: curP() };
});
vp.addEventListener("gesturechange", (e) => {
  if (!gesture) return;
  zoomTo(gesture.p0 * e.scale, e.clientX);
});
vp.addEventListener("gestureend", () => {
  if (gesture) {
    gesture = null;
    requestAnimationFrame(settle);
  }
});
window.addEventListener("keydown", (e) => {
  if (e.target.tagName === "INPUT") return;
  if (e.key === "+" || e.key === "=") zoomTo(curP() * 1.25);
  if (e.key === "-" || e.key === "_") zoomTo(curP() / 1.25);
});

// 부드러운 가로 스크롤 (마우스 휠)
const smooth = { target: 0, raf: 0, pos: 0, last: 0 };
function stopSmooth() {
  if (smooth.raf) {
    cancelAnimationFrame(smooth.raf);
    smooth.raf = 0;
  }
}
function smoothStep() {
  smooth.raf = 0;
  // 다른 방법(트랙패드 가로 밀기, 스크롤바, 드래그)으로 위치가 바뀌었으면 애니메이션을 멈춤
  if (Math.abs(vp.scrollLeft - smooth.last) > 3) return;
  const max = vp.scrollWidth - vp.clientWidth;
  smooth.target = Math.max(0, Math.min(max, smooth.target));
  const d = smooth.target - smooth.pos;
  if (Math.abs(d) < 1) {
    vp.scrollLeft = smooth.target;
    return;
  }
  smooth.pos += d * 0.22;
  vp.scrollLeft = smooth.pos;
  smooth.last = vp.scrollLeft;
  smooth.raf = requestAnimationFrame(smoothStep);
}
vp.addEventListener(
  "wheel",
  (e) => {
    const unit =
      e.deltaMode === 1 ? 32 : e.deltaMode === 2 ? vp.clientWidth : 1;
    // 트랙패드 오므리기는 Ctrl+휠로 들어옴. 크롬은 0.01을 곱하면 손가락 움직임과 같은 배율이 되도록 보냄
    // 마우스 휠 한 칸(100)은 너무 크므로 25까지만 받아 한 칸에 약 1.28배
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      stopSmooth();
      const dy = Math.max(-25, Math.min(25, e.deltaY * unit));
      zoomTo(curP() * Math.exp(-dy * 0.01), e.clientX);
      return;
    }
    if (e.shiftKey) {
      e.preventDefault();
      vp.scrollTop += (e.deltaY || e.deltaX) * unit;
      return;
    }
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      e.preventDefault();
      const dy = e.deltaY * unit;
      const max = vp.scrollWidth - vp.clientWidth;
      if (!smooth.raf) {
        smooth.target = smooth.pos = smooth.last = vp.scrollLeft;
      }
      smooth.target = Math.max(
        0,
        Math.min(max, smooth.target + dy * 1.2),
      );
      if (!smooth.raf) smooth.raf = requestAnimationFrame(smoothStep);
    } else {
      // 가로 방향 입력(트랙패드)은 브라우저 기본 스크롤에 맡기고, 진행 중인 애니메이션은 멈춤
      stopSmooth();
    }
  },
  { passive: false },
);

// 드래그 이동
let drag = null,
  justDragged = false;
vp.addEventListener("pointerdown", (e) => {
  if (e.button !== 0 || e.pointerType === "touch") return;
  if (smooth.raf) {
    cancelAnimationFrame(smooth.raf);
    smooth.raf = 0;
  }
  drag = {
    x: e.clientX,
    y: e.clientY,
    sl: vp.scrollLeft,
    st: vp.scrollTop,
    moved: false,
    id: e.pointerId,
  };
});
vp.addEventListener(
  "click",
  (e) => {
    if (justDragged) {
      e.preventDefault();
      e.stopPropagation();
      justDragged = false;
    }
  },
  true,
);
let tipRaf = 0,
  tipEv = null;
vp.addEventListener("pointermove", (e) => {
  if (drag) {
    const dx = e.clientX - drag.x,
      dy = e.clientY - drag.y;
    if (!drag.moved && Math.abs(dx) + Math.abs(dy) > 4) {
      drag.moved = true;
      vp.classList.add("drag");
      tip.style.display = "none";
      try {
        vp.setPointerCapture(drag.id);
      } catch (_) {}
    }
    if (drag.moved) {
      vp.scrollLeft = drag.sl - dx;
      vp.scrollTop = drag.st - dy;
    }
    return;
  }
  tipEv = e;
  if (!tipRaf)
    tipRaf = requestAnimationFrame(() => {
      tipRaf = 0;
      const t = tipEv.target.closest && tipEv.target.closest(".ev");
      if (t) {
        if (tip.dataset.src !== t.dataset.tip) {
          tip.dataset.src = t.dataset.tip;
          tip.textContent = t.dataset.tip.replace(/ \| /g, "\n");
        }
        tip.style.display = "block";
        const tw = tip.offsetWidth,
          th = tip.offsetHeight;
        const ty =
          tipEv.clientY + 16 + th > window.innerHeight - 8
            ? tipEv.clientY - th - 10
            : tipEv.clientY + 16;
        tip.style.transform = `translate(${Math.max(8, Math.min(tipEv.clientX + 12, window.innerWidth - tw - 8))}px,${ty}px)`;
      } else tip.style.display = "none";
    });
});
const endDrag = () => {
  if (drag && drag.moved) {
    justDragged = true;
    setTimeout(() => {
      justDragged = false;
    }, 0);
  }
  drag = null;
  vp.classList.remove("drag");
};
vp.addEventListener("pointerup", endDrag);
vp.addEventListener("pointercancel", endDrag);
vp.addEventListener("pointerleave", () => {
  if (!drag) tip.style.display = "none";
});
window.addEventListener("resize", () => {
  vpLeft = vp.getBoundingClientRect().left;
  schedule();
});

// ===== 사이드바 (넓은 화면에서는 옆에 붙고, 좁은 화면에서는 위에 겹쳐 열림) =====
const sidebar = document.getElementById("sidebar"),
  sidebtn = document.getElementById("sidebtn");
const narrowScreen = window.matchMedia("(max-width: 700px)");
let isSideOpen = !narrowScreen.matches;
try {
  const saved = localStorage.getItem("tl-side");
  if (saved !== null && !narrowScreen.matches) isSideOpen = saved === "1";
} catch (e) {}
function setSidebar(isOpen) {
  isSideOpen = isOpen;
  document.body.classList.toggle("noside", !isOpen);
  sidebtn.setAttribute("aria-pressed", String(isOpen));
  if (!narrowScreen.matches) {
    try {
      localStorage.setItem("tl-side", isOpen ? "1" : "0");
    } catch (e) {}
  }
}
sidebtn.addEventListener("click", (e) => {
  e.stopPropagation();
  setSidebar(!isSideOpen);
});
// 사이드바가 다 열리거나 닫힌 뒤 연표 폭을 다시 잼
sidebar.addEventListener("transitionend", () => {
  vpLeft = vp.getBoundingClientRect().left;
  schedule();
});
vp.addEventListener("pointerdown", () => {
  if (narrowScreen.matches && isSideOpen) setSidebar(false);
});
setSidebar(isSideOpen);

// ===== 검색 =====
const q = document.getElementById("q"),
  qn = document.getElementById("qn");
const norm = (t) =>
  t.toLowerCase().replace(/[\s『』「」<>《》()（）ㆍ·,.'"]/g, "");
EV.forEach((e) => {
  e.key = norm(e.name);
});
const reduceMotion =
  window.matchMedia &&
  matchMedia("(prefers-reduced-motion: reduce)").matches;
let hits = [],
  hitI = -1,
  curEl = null,
  qTimer = 0;
function findHits() {
  const k = norm(q.value);
  body.classList.toggle("searching", !!k);
  EV.forEach((e) =>
    e.el.classList.toggle("hit", !!k && e.key.includes(k)),
  );
  if (!k) {
    hits = [];
    hitI = -1;
    qn.textContent = "";
    setCur(null);
    return;
  }
  const all = EV_MAIN.filter((e) => e.key.includes(k));
  hits = all
    .filter((e) => e.vis)
    .sort((a, b) => a.y - b.y || (a.m || 0) - (b.m || 0));
  const off = all.length - hits.length;
  const un = UNPLACED.filter((u) => norm(u[1]).includes(k)).length;
  const extra = [
    off ? `꺼 둔 항목 ${off}건` : "",
    un ? `연도 미확인 ${un}건` : "",
  ]
    .filter(Boolean)
    .join(", ");
  qn.dataset.extra = extra;
  if (!hits.length) {
    hitI = -1;
    setCur(null);
    qn.textContent = extra ? `보이는 결과 없음 (${extra})` : "결과 없음";
  }
}
function label() {
  if (hitI < 0) return;
  const extra = qn.dataset.extra;
  qn.textContent =
    `${hits.length}건 중 ${hitI + 1}번째` + (extra ? ` (${extra})` : "");
}
function setCur(e) {
  if (curEl) curEl.classList.remove("cur");
  curEl = e ? e.el : null;
  if (curEl) curEl.classList.add("cur");
}
function goHit() {
  const e = hits[hitI];
  if (!e) return;
  setCur(e);
  label();
  stopSmooth();
  const left = Math.max(0, e.x - vp.clientWidth / 2 + e.w / 2);
  const top = Math.max(0, e.t + axis.offsetHeight - vp.clientHeight / 2);
  const far = Math.abs(left - vp.scrollLeft) > vp.clientWidth * 2;
  vp.scrollTo({
    left,
    top,
    behavior: reduceMotion || far ? "auto" : "smooth",
  });
}
function step(d) {
  findHits();
  if (!hits.length) return;
  const cur = curEl ? hits.findIndex((h) => h.el === curEl) : -1;
  hitI = cur < 0 ? 0 : (cur + d + hits.length) % hits.length;
  goHit();
}
q.addEventListener("input", () => {
  clearTimeout(qTimer);
  qTimer = setTimeout(() => {
    setCur(null);
    findHits();
    if (hits.length) {
      hitI = 0;
      goHit();
    }
  }, 160);
});
q.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    clearTimeout(qTimer);
    step(e.shiftKey ? -1 : 1);
  }
  if (e.key === "Escape") {
    q.value = "";
    findHits();
    q.blur();
  }
});
document.getElementById("qnext").onclick = () => step(1);
document.getElementById("qprev").onclick = () => step(-1);
window.addEventListener("keydown", (e) => {
  if (e.key === "/" && e.target.tagName !== "INPUT") {
    e.preventDefault();
    q.focus();
    q.select();
  }
});

measure();
render();
vp.scrollLeft = xOf(1904, 0) - PAD;
smooth.target = vp.scrollLeft;
if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(() => {
    const sl = vp.scrollLeft;
    measure();
    render();
    vp.scrollLeft = sl;
    smooth.target = sl;
  });
}
