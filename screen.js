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
    Object.entries(players).forEach(([playerId, player]) => {
      if (!existing.has(playerId)) {
        ranked.push({
          playerId,
          name: player.name || "No Name",
          value: null
        });
      }
    });
    return ranked;
  }

  function applyRankStyle(cell, index, total) {
    if (currentPhase !== "rank" || total <= 1) {
      cell.style.backgroundColor = "#ffffff";
      cell.style.color = "#111111";
      return;
    }
    const ratio = index / (total - 1);
    const shade = Math.round(255 * (1 - ratio));
    cell.style.backgroundColor = `rgb(${shade}, ${shade}, ${shade})`;
    cell.style.color = shade < 120 ? "#ffffff" : "#111111";
  }

  function renderGrid() {
    resultGrid.innerHTML = "";
    const stage = getStageByIndex(currentStageIndex);
    const showResults = currentPhase === "reveal" || currentPhase === "rank";
    const showQuestion = currentPhase === "open";
    const entries = showResults ? buildEntries() : [];

    questionOverlay.hidden = !showQuestion;
    questionOverlay.style.display = showQuestion ? "flex" : "none";
    resultGrid.style.visibility = showResults ? "visible" : "hidden";

    stageImage.src = stage.image || "";
    stageImage.style.visibility = showQuestion && stage.image ? "visible" : "hidden";

    for (let i = 0; i < MAX_CELLS; i += 1) {
      const entry = entries[i];
      const cell = document.createElement("div");
      cell.className = "screen-cell";

      if (!entry) {
        cell.classList.add("cell-empty");
        cell.innerHTML = "<div class=\"cell-name\">-</div><div class=\"cell-value\">-</div>";
      } else {
        const name = entry.name || "No Name";
        const value = formatValue(entry.value, stage);
        cell.innerHTML = `
          <div class=\"cell-name\">${name}</div>
          <div class=\"cell-value\">${value}</div>
        `;
        applyRankStyle(cell, i, entries.length);
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
