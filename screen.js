(() => {
  const stateRef = db.ref("game/state");
  const resultsRef = db.ref("results");
  const playersRef = db.ref("players");

  const stageLabel = document.getElementById("stageLabel");
  const stagePrompt = document.getElementById("stagePrompt");
  const resultGrid = document.getElementById("resultGrid");
  const questionOverlay = document.getElementById("questionOverlay");
  const stageImage = document.getElementById("stageImage");
  const explainOverlay = document.getElementById("explainOverlay");
  const explainImage = document.getElementById("explainImage");

  const MAX_STAGE = GAME_STAGES.length;
  const MAX_CELLS = 18;

  let currentStageIndex = 1;
  let currentPhase = "waiting";
  let explainVisible = false;
  let resultListener = null;
  let observedStageIndex = null;
  let players = {};
  let currentResults = null;

  function formatValue(value, stage) {
    if (value === null || value === undefined || Number.isNaN(value)) {
      return "-";
    }
    const precision = stage.precision ?? (Number.isInteger(value) ? 0 : 2);
    const fixed = typeof value === "number" ? value.toFixed(precision) : String(value);
    return stage.unit ? `${fixed} ${stage.unit}` : fixed;
  }

  function buildEntries() {
    const ranked = currentResults && currentResults.ranked ? [...currentResults.ranked] : [];
    const existing = new Set(ranked.map((entry) => entry.playerId));
    if (!(currentResults && currentResults.includesAll)) {
      Object.entries(players).forEach(([playerId, player]) => {
        if (!existing.has(playerId)) {
          ranked.push({
            playerId,
            name: player.name || "No Name",
            value: null
          });
        }
      });
    }
    const stage = getStageByIndex(currentStageIndex);
    let answerEntry = null;
    if (stage.type === "overlay") {
      const baseSize = (stage.baseSize || 160) * (stage.visualScale || 1);
      answerEntry = {
        playerId: "answer",
        name: "正解",
        value: 0,
        meta: {
          offsetX: 0,
          offsetY: 0,
          scale: 1,
          baseSize
        }
      };
    }
    return { ranked, answerEntry };
  }

  function applyRankStyle(cell, rank, maxRank) {
    if (currentPhase !== "rank" || maxRank <= 1) {
      cell.style.backgroundColor = "#ffffff";
      cell.style.color = "#111111";
      return;
    }
    const ratio = (rank - 1) / (maxRank - 1);
    const shade = Math.round(255 * (1 - ratio));
    cell.style.backgroundColor = `rgb(${shade}, ${shade}, ${shade})`;
    cell.style.color = shade < 120 ? "#ffffff" : "#111111";
  }

  function renderGrid() {
    resultGrid.innerHTML = "";
    const stage = getStageByIndex(currentStageIndex);
    const showResults = currentPhase === "reveal" || currentPhase === "rank";
    const showQuestion = currentPhase === "open";
    const { ranked: baseEntries, answerEntry } = showResults ? buildEntries() : { ranked: [], answerEntry: null };
    let entries = baseEntries;
    if (showResults) {
      entries = [...baseEntries].sort((a, b) => {
        const valueA = typeof a.value === "number" ? a.value : Number.NEGATIVE_INFINITY;
        const valueB = typeof b.value === "number" ? b.value : Number.NEGATIVE_INFINITY;
        if (!Number.isFinite(valueA) && !Number.isFinite(valueB)) {
          return 0;
        }
        if (!Number.isFinite(valueA)) {
          return 1;
        }
        if (!Number.isFinite(valueB)) {
          return -1;
        }
        return valueB - valueA;
      });
    }
    const maxRank = entries.reduce((acc, entry) => {
      if (entry.playerId === "answer") {
        return acc;
      }
      if (typeof entry.rank === "number") {
        return Math.max(acc, entry.rank);
      }
      return acc;
    }, 0);

    questionOverlay.hidden = !showQuestion;
    questionOverlay.style.display = showQuestion ? "flex" : "none";
    resultGrid.style.visibility = showResults ? "visible" : "hidden";

    stageImage.src = stage.image || "";
    stageImage.style.visibility = showQuestion && stage.image ? "visible" : "hidden";

    for (let i = 0; i < MAX_CELLS; i += 1) {
      const entry = i === MAX_CELLS - 1 && answerEntry ? answerEntry : entries[i];
      const cell = document.createElement("div");
      cell.className = "screen-cell";

      if (!entry) {
        cell.classList.add("cell-empty");
        cell.innerHTML = "<div class=\"cell-name\">-</div><div class=\"cell-value\">-</div>";
      } else {
        const name = entry.name || "No Name";
        const rankLabel = currentPhase === "rank" && entry.playerId !== "answer"
          ? `#${entry.rank ?? i + 1}`
          : "";

        if (stage.type === "overlay" && entry.meta) {
          const nameRow = document.createElement("div");
          nameRow.className = "cell-name-row";

          const nameEl = document.createElement("div");
          nameEl.className = "cell-name";
          nameEl.textContent = name;

          if (rankLabel) {
            const rankEl = document.createElement("div");
            rankEl.className = "cell-rank-inline";
            rankEl.textContent = rankLabel;
            nameRow.append(nameEl, rankEl);
          } else {
            nameRow.append(nameEl);
          }

          const preview = document.createElement("div");
          preview.className = "cell-overlay";

          const base = document.createElement("img");
          base.className = "cell-overlay-base";
          base.src = stage.baseImage || "";

          const overlay = document.createElement("img");
          overlay.className = "cell-overlay-target";
          overlay.src = stage.overlayImage || "";

          const visualScale = stage.visualScale || 1;
          const baseSize = (stage.baseSize || 160) * visualScale;
          const scale = entry.meta.scale ?? 1;
          const offsetX = entry.meta.offsetX ?? 0;
          const offsetY = entry.meta.offsetY ?? 0;

          base.style.width = `${baseSize}px`;
          base.style.height = `${baseSize}px`;
          overlay.style.width = `${baseSize}px`;
          overlay.style.height = `${baseSize}px`;
          overlay.style.transform = `translate(-50%, -50%) translate(${offsetX}px, ${offsetY}px) scale(${scale})`;

          preview.append(base, overlay);
          cell.append(nameRow, preview);
        } else {
          const value = formatValue(entry.value, stage);
          const nameRowHtml = rankLabel
            ? `<div class=\"cell-name-row\"><div class=\"cell-name\">${name}</div><div class=\"cell-rank-inline\">${rankLabel}</div></div>`
            : `<div class=\"cell-name-row\"><div class=\"cell-name\">${name}</div></div>`;
          cell.innerHTML = `
            ${nameRowHtml}
            <div class=\"cell-value\">${value}</div>
          `;
        }

        if (entry.playerId !== "answer") {
          applyRankStyle(cell, entry.rank ?? i + 1, maxRank || entries.length || 1);
        }
      }

      resultGrid.appendChild(cell);
    }
  }

  function watchResults(stageIndex) {
    if (resultListener) {
      resultsRef.child(observedStageIndex).off("value", resultListener);
    }
    resultListener = (snapshot) => {
      currentResults = snapshot.val();
      renderGrid();
    };
    resultsRef.child(stageIndex).on("value", resultListener);
    observedStageIndex = stageIndex;
  }

  stateRef.on("value", (snapshot) => {
    const state = snapshot.val() || { stageIndex: 1, phase: "waiting", explain: false };
    currentStageIndex = Math.min(MAX_STAGE, Math.max(1, state.stageIndex || 1));
    currentPhase = state.phase || "waiting";
    explainVisible = Boolean(state.explain);
    const stage = getStageByIndex(currentStageIndex);
    stageLabel.textContent = `${stage.id} / ${GAME_STAGES.length}  ${stage.title}`;
    stagePrompt.textContent = currentPhase === "waiting" ? "待機中" : stage.prompt;
    watchResults(currentStageIndex);
    explainImage.src = stage.explainImage || "";
    explainOverlay.hidden = !explainVisible;
    explainOverlay.style.display = explainVisible ? "flex" : "none";
    renderGrid();
  });

  playersRef.on("value", (snapshot) => {
    players = snapshot.val() || {};
    renderGrid();
  });
})();
