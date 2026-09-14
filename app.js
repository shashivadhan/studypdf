
import * as pdfjsLib from "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs";

pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs";


/* =========================
   DOM HELPER
========================= */

const $ = (id) => document.getElementById(id);


/* =========================
   APPLICATION STATE
========================= */

const state = {
  pdf: null,
  file: null,
  original: null,

  page: 1,
  scale: 1,

  tool: "select",
  color: "#ffe34d",
  size: 4,

  annotations: {},

  strokes: [],
  highlights: [],
  notes: []
};


/* =========================
   RENDER STATE
========================= */

let renderTask = null;
let renderVersion = 0;
let changingPage = false;

let drawing = false;
let currentStroke = null;
let start = null;
let preview = null;


/* =========================
   STATUS / ERROR
========================= */

const setStatus = (message) => {
  $("saveStatus").textContent = message;
};

const error = (message) => {
  $("errorBox").textContent = message || "";
};


/* =========================
   PAGE ANNOTATION DATA
========================= */

const pageData = () => {

  if (!state.annotations[state.page]) {

    state.annotations[state.page] = {
      strokes: [],
      highlights: [],
      notes: []
    };

  }

  return state.annotations[state.page];

};


function syncPage() {

  const data = pageData();

  state.strokes = data.strokes;
  state.highlights = data.highlights;
  state.notes = data.notes;

}


function savePage() {

  state.annotations[state.page] = {

    strokes: state.strokes,
    highlights: state.highlights,
    notes: state.notes

  };

  setStatus("Changes saved locally");

}


/* =========================
   ENABLE / DISABLE CONTROLS
========================= */

function enable(on) {

  [
    "prevPage",
    "nextPage",
    "pageNumber",
    "zoomOut",
    "zoomIn",
    "fitPage",
    "addNote",
    "downloadPdf",
    "downloadAnnotations",
    "clearPage"

  ].forEach((id) => {

    $(id).disabled = !on;

  });

}


/* =========================
   NAVIGATION UI
========================= */

function nav() {

  $("pageNumber").value = state.page;

  $("pageCount").textContent =
    state.pdf?.numPages || "—";

  $("prevPage").disabled =
    !state.pdf ||
    state.page <= 1 ||
    changingPage;

  $("nextPage").disabled =
    !state.pdf ||
    state.page >= state.pdf.numPages ||
    changingPage;

  $("pageNumber").disabled =
    !state.pdf ||
    changingPage;

  $("zoomLabel").textContent =
    Math.round(state.scale * 100) + "%";

}


/* =========================
   TOOL SELECTION
========================= */

function tool(t) {

  state.tool = t;

  document.querySelectorAll("[data-tool]").forEach((button) => {

    button.classList.toggle(
      "active",
      button.dataset.tool === t
    );

  });

  $("toolHint").textContent = {

    select: "Select and navigate the PDF.",

    highlight:
      "Drag a rectangle over the page to highlight.",

    pen:
      "Draw directly on the page.",

    eraser:
      "Draw over strokes to erase them.",

    note:
      "Click the page to place the note from the text box."

  }[t];

}


/* =========================
   COLOR SELECTION
========================= */

function color(c) {

  state.color = c;

  document.querySelectorAll(".color").forEach((button) => {

    button.classList.toggle(
      "active",
      button.dataset.color === c
    );

  });

}


/* =========================
   NORMALIZED POINTER POSITION
========================= */

function pos(e) {

  const rect =
    $("inkCanvas").getBoundingClientRect();

  return [

    Math.max(
      0,
      Math.min(
        1,
        (e.clientX - rect.left) / rect.width
      )
    ),

    Math.max(
      0,
      Math.min(
        1,
        (e.clientY - rect.top) / rect.height
      )
    )

  ];

}


/* =========================
   RENDER HIGHLIGHTS
========================= */

function renderHighlights() {

  const layer = $("highlightLayer");

  layer.innerHTML = "";

  for (const h of state.highlights) {

    const el = document.createElement("div");

    el.className = "hl";

    Object.assign(el.style, {

      left: h.x * 100 + "%",
      top: h.y * 100 + "%",
      width: h.w * 100 + "%",
      height: h.h * 100 + "%",

      background: h.color + "99"

    });

    layer.append(el);

  }

}


/* =========================
   RENDER PEN STROKES
========================= */

function renderStrokes() {

  const canvas = $("inkCanvas");

  const ctx = canvas.getContext("2d");

  ctx.clearRect(
    0,
    0,
    canvas.width,
    canvas.height
  );

  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  for (const s of state.strokes) {

    if (!s.points.length) continue;

    ctx.strokeStyle = s.color;

    ctx.lineWidth =
      s.size * state.scale;

    ctx.beginPath();

    ctx.moveTo(

      s.points[0][0] * canvas.width,
      s.points[0][1] * canvas.height

    );

    for (let i = 1; i < s.points.length; i++) {

      ctx.lineTo(

        s.points[i][0] * canvas.width,
        s.points[i][1] * canvas.height

      );

    }

    ctx.stroke();

  }

}


/* =========================
   RENDER NOTES
========================= */

function renderNotes() {

  const layer = $("noteLayer");

  layer.innerHTML = "";

  state.notes.forEach((n) => {

    const b = document.createElement("button");

    b.className = "note-pin";

    b.textContent = "N";

    b.title = n.text;

    b.style.left =
      n.x * 100 + "%";

    b.style.top =
      n.y * 100 + "%";

    b.onclick = () => {

      $("noteText").value = n.text;

      $("noteText").focus();

    };

    layer.append(b);

  });


  const list = $("notesList");

  list.innerHTML = "";


  if (!state.notes.length) {

    list.innerHTML =
      '<p class="muted">No notes on this page.</p>';

    return;

  }


  state.notes.forEach((n, i) => {

    const d = document.createElement("div");

    d.className = "note-item";


    const small = document.createElement("small");

    small.textContent =
      `Page ${state.page}`;


    const text = document.createElement("div");

    text.textContent = n.text;


    const deleteButton =
      document.createElement("button");

    deleteButton.textContent = "Delete";


    deleteButton.onclick = () => {

      state.notes.splice(i, 1);

      savePage();

      renderNotes();

    };


    d.append(
      small,
      text,
      deleteButton
    );

    list.append(d);

  });

}


/* =========================
   RENDER ALL OVERLAYS
========================= */

function overlays() {

  renderHighlights();

  renderStrokes();

  renderNotes();

}


/* =====================================================
   IMPORTANT MULTI-PAGE PDF RENDER FIX
=====================================================

   This version prevents old page-render requests from
   overwriting the newly selected page.

   It also waits for getPage() and render() properly.
===================================================== */

async function renderPage() {

  if (!state.pdf) return;


  const thisRender =
    ++renderVersion;

  const requestedPage =
    state.page;


  // Load annotations for the selected page
  syncPage();


  // Cancel previous render safely
  if (renderTask) {

    try {

      renderTask.cancel();

    } catch {

      // Ignore cancellation errors

    }

  }


  try {

    // Get the requested page
    const page =
      await state.pdf.getPage(requestedPage);


    // Ignore stale requests
    if (

      thisRender !== renderVersion ||
      requestedPage !== state.page

    ) {

      return;

    }


    // Calculate page size
    const viewport =
      page.getViewport({
        scale: state.scale
      });


    const pdfCanvas =
      $("pdfCanvas");

    const inkCanvas =
      $("inkCanvas");

    const pageStage =
      $("pageStage");


    // Set page dimensions
    pageStage.style.width =
      viewport.width + "px";

    pageStage.style.height =
      viewport.height + "px";


    pdfCanvas.width =
      Math.ceil(viewport.width);

    pdfCanvas.height =
      Math.ceil(viewport.height);


    inkCanvas.width =
      Math.ceil(viewport.width);

    inkCanvas.height =
      Math.ceil(viewport.height);


    // Render selected PDF page
    renderTask = page.render({

      canvasContext:
        pdfCanvas.getContext("2d"),

      viewport: viewport

    });


    try {

      await renderTask.promise;

    } catch (e) {

      if (
        e.name ===
        "RenderingCancelledException"
      ) {

        return;

      }

      throw e;

    }


    // Do not display stale page
    if (

      thisRender !== renderVersion ||
      requestedPage !== state.page

    ) {

      return;

    }


    // Draw annotations for selected page
    overlays();

    nav();


  } catch (e) {

    if (
      e.name !==
      "RenderingCancelledException"
    ) {

      console.error(
        "Page rendering error:",
        e
      );

      error(
        "Could not render page " +
        requestedPage +
        ": " +
        e.message
      );

    }

  } finally {

    if (
      thisRender === renderVersion
    ) {

      renderTask = null;

    }

  }

}


/* =========================
   CHANGE PAGE
========================= */

async function changePage(nextPage) {

  if (
    !state.pdf ||
    changingPage
  ) {

    return;

  }


  const targetPage = Math.max(

    1,

    Math.min(

      state.pdf.numPages,

      Number(nextPage)

    )

  );


  if (
    targetPage === state.page
  ) {

    return;

  }


  changingPage = true;

  nav();

  setStatus(
    `Opening page ${targetPage}…`
  );


  // Save current page annotations
  savePage();


  // Change selected page
  state.page = targetPage;


  try {

    await renderPage();

    setStatus(
      `Page ${state.page} ready`
    );

  } catch (e) {

    console.error(e);

    error(
      `Could not open page ${targetPage}: ${e.message}`
    );

  } finally {

    changingPage = false;

    nav();

  }

}


/* =========================
   OPEN PDF FILE
========================= */

async function openFile(file) {

  if (!file) return;


  if (

    file.type !== "application/pdf" &&

    !file.name
      .toLowerCase()
      .endsWith(".pdf")

  ) {

    return error(
      "Please choose a PDF file."
    );

  }


  try {

    setStatus("Opening PDF…");

    error("");


    // Read file into memory
    const buf =
      await file.arrayBuffer();


    /*
      IMPORTANT ARRAYBUFFER FIX

      PDF.js may detach the buffer it receives.

      Therefore create two independent copies.

      Copy 1 = Original PDF download
      Copy 2 = PDF.js viewer
    */


    const originalCopy =
      new Uint8Array(
        buf.slice(0)
      );


    const pdfCopy =
      new Uint8Array(
        buf.slice(0)
      );


    // Load PDF using independent copy
    const loadedPdf =
      await pdfjsLib.getDocument({

        data: pdfCopy

      }).promise;


    // Store PDF state
    state.pdf = loadedPdf;

    state.file = file;

    state.original = originalCopy;


    // Reset viewer
    state.page = 1;

    state.scale = 1;

    state.annotations = {};


    // Update UI
    $("fileName").textContent =
      file.name;


    $("fileMeta").textContent =

      Math.round(
        file.size / 1024
      ) +

      " KB · " +

      state.pdf.numPages +

      " pages";


    $("emptyState").hidden =
      true;


    $("viewerContent").hidden =
      false;


    enable(true);

    nav();


    // Render first page
    await renderPage();


    setStatus("PDF ready");


  } catch (e) {

    console.error(
      "PDF loading error:",
      e
    );

    error(
      "Could not open PDF: " +
      e.message
    );

    setStatus("Error");

  }

}


/* =========================
   ERASER HIT DETECTION
========================= */

function hit(p, s) {

  return s.points.some((q) => {

    return Math.hypot(

      (q[0] - p[0]) *
        $("inkCanvas").width,

      (q[1] - p[1]) *
        $("inkCanvas").height

    ) < Math.max(

      12,

      s.size * state.scale + 8

    );

  });

}


/* =========================
   DOWNLOAD HELPER
========================= */

function download(blob, name) {

  const u =
    URL.createObjectURL(blob);

  const a =
    document.createElement("a");

  a.href = u;

  a.download = name;

  document.body.append(a);

  a.click();

  a.remove();


  setTimeout(() => {

    URL.revokeObjectURL(u);

  }, 1000);

}


/* =========================
   TOOL BUTTONS
========================= */

document
  .querySelectorAll("[data-tool]")
  .forEach((b) => {

    b.onclick = () =>
      tool(b.dataset.tool);

  });


/* =========================
   COLOR BUTTONS
========================= */

document
  .querySelectorAll(".color")
  .forEach((b) => {

    b.onclick = () =>
      color(b.dataset.color);

  });


/* =========================
   PEN SIZE
========================= */

$("penSize").onchange = (e) => {

  state.size =
    Number(e.target.value);

};


/* =========================
   UPLOAD BUTTONS
========================= */

$("uploadTop").onclick =
  $("emptyUpload").onclick = () => {

    $("fileInput").click();

  };


$("fileInput").onchange = (e) => {

  openFile(
    e.target.files[0]
  );

};


/* =========================
   PAGE NAVIGATION BUTTONS
========================= */

$("prevPage").onclick = () => {

  changePage(
    state.page - 1
  );

};


$("nextPage").onclick = () => {

  changePage(
    state.page + 1
  );

};


$("pageNumber").onchange = (e) => {

  changePage(
    Number(e.target.value) || 1
  );

};


/* =========================
   ZOOM CONTROLS
========================= */

$("zoomIn").onclick = () => {

  state.scale =
    Math.min(
      4,
      state.scale + 0.25
    );

  renderPage();

};


$("zoomOut").onclick = () => {

  state.scale =
    Math.max(
      0.25,
      state.scale - 0.25
    );

  renderPage();

};


/* =========================
   FIT PAGE
========================= */

$("fitPage").onclick = async () => {

  if (!state.pdf) return;


  const page =
    await state.pdf.getPage(
      state.page
    );


  const viewport =
    page.getViewport({
      scale: 1
    });


  const availableWidth =
    $("paperArea").clientWidth - 16;


  state.scale =
    Math.max(

      0.2,

      Math.min(

        3,

        availableWidth /
          viewport.width

      )

    );


  renderPage();

};


/* =====================================================
   DRAWING START
===================================================== */

$("inkCanvas").addEventListener(
  "pointerdown",
  (e) => {

    if (
      !state.pdf ||
      changingPage
    ) {

      return;

    }


    if (

      state.tool === "pen" ||

      state.tool === "eraser"

    ) {

      drawing = true;


      currentStroke = {

        points: [
          pos(e)
        ],

        color:
          state.color,

        size:
          state.size

      };


      $("inkCanvas")
        .setPointerCapture(
          e.pointerId
        );


    } else if (

      state.tool === "highlight"

    ) {

      start = pos(e);

    }

  }

);


/* =====================================================
   DRAWING MOVE
===================================================== */

$("inkCanvas").addEventListener(
  "pointermove",
  (e) => {


    /* HIGHLIGHT PREVIEW */

    if (

      state.tool === "highlight" &&
      start

    ) {

      const p =
        pos(e);


      const x =
        Math.min(
          start[0],
          p[0]
        );


      const y =
        Math.min(
          start[1],
          p[1]
        );


      const w =
        Math.abs(
          p[0] - start[0]
        );


      const h =
        Math.abs(
          p[1] - start[1]
        );


      if (!preview) {

        preview =
          document.createElement(
            "div"
          );

        preview.className =
          "hl";

        $("highlightLayer")
          .append(preview);

      }


      Object.assign(
        preview.style,
        {

          left:
            x * 100 + "%",

          top:
            y * 100 + "%",

          width:
            w * 100 + "%",

          height:
            h * 100 + "%",

          background:
            state.color + "99"

        }

      );

    }


    /* PEN / ERASER */

    if (
      !drawing ||
      !currentStroke
    ) {

      return;

    }


    const p =
      pos(e);


    if (
      state.tool === "pen"
    ) {


      currentStroke.points.push(
        p
      );


      const c =
        $("inkCanvas");


      const ctx =
        c.getContext("2d");


      const a =
        currentStroke.points;


      const prev =
        a[a.length - 2];


      ctx.strokeStyle =
        currentStroke.color;


      ctx.lineWidth =
        currentStroke.size *
        state.scale;


      ctx.lineCap =
        "round";


      ctx.beginPath();


      ctx.moveTo(

        prev[0] * c.width,

        prev[1] * c.height

      );


      ctx.lineTo(

        p[0] * c.width,

        p[1] * c.height

      );


      ctx.stroke();


    } else {


      // Erase strokes
      state.strokes =
        state.strokes.filter(
          (s) => !hit(p, s)
        );


      renderStrokes();

    }

  }

);


/* =====================================================
   DRAWING END
===================================================== */

function finishPointer(e) {


  /* SAVE PEN STROKE */

  if (

    state.tool === "pen" &&

    drawing &&

    currentStroke

  ) {

    state.strokes.push(
      currentStroke
    );

    savePage();

  }


  /* SAVE HIGHLIGHT */

  if (

    state.tool === "highlight" &&

    start

  ) {


    const p =
      pos(e);


    const x =
      Math.min(
        start[0],
        p[0]
      );


    const y =
      Math.min(
        start[1],
        p[1]
      );


    const w =
      Math.abs(
        p[0] - start[0]
      );


    const h =
      Math.abs(
        p[1] - start[1]
      );


    if (

      w > 0.005 &&
      h > 0.005

    ) {

      state.highlights.push({

        x,
        y,
        w,
        h,

        color:
          state.color

      });


      savePage();

    }


    if (preview) {

      preview.remove();

      preview = null;

    }


    renderHighlights();

  }


  drawing = false;

  currentStroke = null;

  start = null;

}


/* =========================
   POINTER EVENTS
========================= */

$("inkCanvas").addEventListener(
  "pointerup",
  finishPointer
);


$("inkCanvas").addEventListener(
  "pointercancel",
  finishPointer
);


/* =========================
   NOTE CLICK ON PAGE
========================= */

$("inkCanvas").addEventListener(
  "click",
  (e) => {

    if (
      state.tool !== "note" ||
      changingPage
    ) {

      return;

    }


    const text =
      $("noteText").value.trim();


    if (!text) return;


    const p =
      pos(e);


    state.notes.push({

      x: p[0],

      y: p[1],

      text

    });


    savePage();

    renderNotes();


    $("noteText").value = "";

  }

);


/* =========================
   ADD NOTE BUTTON
========================= */

$("addNote").onclick = () => {

  const text =
    $("noteText").value.trim();


  if (
    !text ||
    !state.pdf
  ) {

    return;

  }


  state.notes.push({

    x: 0.8,

    y: 0.15,

    text

  });


  savePage();

  renderNotes();


  $("noteText").value = "";

};


/* =========================
   CLEAR CURRENT PAGE
========================= */

$("clearPage").onclick = () => {


  if (
    !confirm(
      "Clear all annotations on this page?"
    )
  ) {

    return;

  }


  state.strokes = [];

  state.highlights = [];

  state.notes = [];


  savePage();

  overlays();

};


/* =========================
   DOWNLOAD ORIGINAL PDF
========================= */

$("downloadPdf").onclick = () => {

  if (!state.original) return;


  const filename =

    (
      state.file?.name ||
      "document.pdf"

    ).replace(
      /\.pdf$/i,
      ""
    ) +

    "-original.pdf";


  download(

    new Blob(

      [state.original],

      {
        type: "application/pdf"
      }

    ),

    filename

  );

};


/* =========================
   EXPORT ANNOTATIONS JSON
========================= */

$("downloadAnnotations").onclick = () => {


  savePage();


  const filename =

    (
      state.file?.name ||
      "document.pdf"

    ).replace(
      /\.pdf$/i,
      ""
    ) +

    "-annotations.json";


  download(

    new Blob(

      [

        JSON.stringify(

          {

            app: "StudyPDF",

            file:
              state.file?.name || "",

            exportedAt:
              new Date().toISOString(),

            pages:
              state.annotations

          },

          null,

          2

        )

      ],

      {
        type: "application/json"
      }

    ),

    filename

  );

};


/* =========================
   INITIAL TOOL
========================= */

tool("select");
