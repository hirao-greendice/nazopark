(() => {
  const stateRef = db.ref("game/state");
  const playersRef = db.ref("players");
  const responsesRef = db.ref("responses");
  const resultsRef = db.ref("results");

  const stageLabel = document.getElementById("stageLabel");
  const stagePrompt = document.getElementById("stagePrompt");
  const phaseLabel = document.getElementById("phaseLabel");
  const playerCount = document.getElementById("playerCount");
  const answerCount = document.getElementById("answerCount");
  const masterNotice = document.getElementById("masterNotice");

  const prevStageBtn = document.getElementById("prevStage");
  const nextStageBtn = document.getElementById("nextStage");
  const setWaitingBtn = document.getElementById("setWaiting");
  const setOpenBtn = document.getElementById("setOpen");
  const showResultsBtn = document.getElementById("showResults");
  const showRankingBtn = document.getElementById("showRanking");
  const showExplainBtn = document.getElementById("showExplain");
  const hideExplainBtn = document.getElementById("hideExplain");
  const resetBtn = document.getElementById("resetGame");

  const resultTableBody = document.querySelector("#resultTable tbody");
  const scoreTableBody = document.querySelector("#scoreTable tbody");
  const answerTableBody = document.querySelector("#answerTable tbody");
  const playerTableBody = document.querySelector("#playerTable tbody");

  const MAX_STAGE = GAME_STAGES.length;
  const POINTS = [3, 2, 1];

  let currentStageIndex = 1;
  let currentPhase = "waiting";
  let explainVisible = false;
  let stageResponsesListener = null;
  let stageResultsListener = null;
  let observedStageIndex = null;

  function formatValue(value, stage) {
    if (value === null || value === undefined || Number.isNaN(value)) {
      return "-";
    }
    const precision = stage.precision ?? (Number.isInteger(value) ? 0 : 2);
    const fixed = typeof value === "number" ? value.toFixed(precision) : String(value);
    return stage.unit ? `${fixed} ${stage.unit}` : fixed;
  }

  function computeDiff(value, stage) {
    if (value === null || value === undefined || Number.isNaN(value)) {
      return Number.POSITIVE_INFINITY;
    }
    const target = Number(stage.target);
    if (Number.isNaN(target)) {
      return Math.abs(value);
    }
    if (stage.wrap) {
      const range = Number(stage.wrap);
      const raw = Math.abs(value - target);
      return Math.min(raw, range - raw);
    }
    return Math.abs(value - target);
  }

  function updateStageUI() {
    const stage = getStageByIndex(currentStageIndex);
    stageLabel.textContent = `${stage.id} / ${MAX_STAGE}  ${stage.title}`;
    stagePrompt.textContent = stage.prompt;
  }

  function setState(partial) {
    return stateRef.update(partial);
  }

  function clampStage(index) {
    return Math.min(MAX_STAGE, Math.max(1, index));
  }

  function renderResults(results, stage) {
    resultTableBody.innerHTML = "";
    if (!results || !results.ranked || results.ranked.length === 0) {
      const row = document.createElement("tr");
      row.innerHTML = "<td colspan=\"5\">回答がまだありません</td>";
      resultTableBody.appendChild(row);
      return;
    }

    results.ranked.forEach((entry, index) => {
      const row = document.createElement("tr");
      const diffValue = computeDiff(entry.value, stage);
      const diffDisplay = Number.isFinite(diffValue) ? diffValue : null;
      const points = entry.points ?? 0;
      row.innerHTML = `
        <td>${entry.rank ?? index + 1}</td>
        <td>${entry.name}</td>
        <td>${formatValue(entry.value, stage)}</td>
        <td>${formatValue(diffDisplay, stage)}</td>
        <td>${points}</td>
      `;
      resultTableBody.appendChild(row);
    });
  }

  function formatMeta(meta, stage) {
    if (!meta) {
      return "-";
    }
    if (stage.type === "overlay") {
      const scale = meta.scale !== undefined ? Number(meta.scale).toFixed(2) : "-";
      const offsetX = meta.offsetX !== undefined ? Math.round(meta.offsetX) : "-";
      const offsetY = meta.offsetY !== undefined ? Math.round(meta.offsetY) : "-";
      return `scale ${scale}, dx ${offsetX}, dy ${offsetY}`;
    }
    return "-";
  }

  function renderAnswers(responses, stage) {
    answerTableBody.innerHTML = "";
    const list = Object.values(responses || {}).map((response) => ({
      name: response.name || "No Name",
      value: response.value,
      meta: response.meta || null,
      submittedAt: response.submittedAt || 0
    }));
    list.sort((a, b) => a.submittedAt - b.submittedAt);

    if (list.length === 0) {
      const row = document.createElement("tr");
      row.innerHTML = "<td colspan=\"4\">回答なし</td>";
      answerTableBody.appendChild(row);
      return;
    }

    list.forEach((entry) => {
      const row = document.createElement("tr");
      const timeText = entry.submittedAt ? new Date(entry.submittedAt).toLocaleTimeString() : "-";
      row.innerHTML = `
        <td>${entry.name}</td>
        <td>${formatValue(Number(entry.value), stage)}</td>
        <td>${formatMeta(entry.meta, stage)}</td>
        <td>${timeText}</td>
      `;
      answerTableBody.appendChild(row);
    });
  }

  function renderScores(players) {
    scoreTableBody.innerHTML = "";
    const list = Object.values(players || {}).map((player) => ({
      id: player.id,
      name: player.name,
      score: player.score || 0
    }));
    list.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

    if (list.length === 0) {
      const row = document.createElement("tr");
      row.innerHTML = "<td colspan=\"3\">参加者なし</td>";
      scoreTableBody.appendChild(row);
      return;
    }

    list.forEach((player, index) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${index + 1}</td>
        <td>${player.name}</td>
        <td>${player.score}</td>
      `;
      scoreTableBody.appendChild(row);
    });
  }

  function renderPlayers(players) {
    playerTableBody.innerHTML = "";
    const list = Object.values(players || {}).map((player) => ({
      id: player.id,
      name: player.name || "No Name",
      score: player.score || 0
    }));
    list.sort((a, b) => a.name.localeCompare(b.name));

    if (list.length === 0) {
      const row = document.createElement("tr");
      row.innerHTML = "<td colspan=\"3\">参加者なし</td>";
      playerTableBody.appendChild(row);
      return;
    }

    list.forEach((player) => {
      const row = document.createElement("tr");
      const nameCell = document.createElement("td");
      nameCell.textContent = player.name;
      const scoreCell = document.createElement("td");
      scoreCell.textContent = player.score;
      const actionCell = document.createElement("td");
      const deleteBtn = document.createElement("button");
      deleteBtn.className = "btn btn-ghost";
      deleteBtn.textContent = "削除";
      deleteBtn.addEventListener("click", () => {
        deletePlayer(player.id).catch((error) => {
          console.error(error);
          masterNotice.textContent = "削除に失敗しました";
        });
      });
      actionCell.appendChild(deleteBtn);
      row.append(nameCell, scoreCell, actionCell);
      playerTableBody.appendChild(row);
    });
  }

  async function deletePlayer(playerId) {
    const confirmed = window.confirm("この参加者を削除します。よろしいですか？");
    if (!confirmed) {
      return;
    }

    const updates = {};
    updates[`players/${playerId}`] = null;
    for (let i = 1; i <= MAX_STAGE; i += 1) {
      updates[`responses/${i}/${playerId}`] = null;
    }
    await db.ref().update(updates);

    const resultsSnap = await resultsRef.once("value");
    const results = resultsSnap.val() || {};
    const resultUpdates = {};
    Object.entries(results).forEach(([stageId, result]) => {
      if (result && result.ranked && Array.isArray(result.ranked)) {
        const filtered = result.ranked.filter((entry) => entry.playerId !== playerId);
        if (filtered.length !== result.ranked.length) {
          resultUpdates[`results/${stageId}/ranked`] = filtered;
        }
      }
    });
    if (Object.keys(resultUpdates).length > 0) {
      await db.ref().update(resultUpdates);
    }
  }

  function watchStage(stageIndex) {
    if (stageResponsesListener) {
      responsesRef.child(observedStageIndex).off("value", stageResponsesListener);
      stageResponsesListener = null;
    }
    if (stageResultsListener) {
      resultsRef.child(observedStageIndex).off("value", stageResultsListener);
      stageResultsListener = null;
    }

    const stage = getStageByIndex(stageIndex);
    stageResponsesListener = (snapshot) => {
      const data = snapshot.val() || {};
      answerCount.textContent = Object.keys(data).length;
      renderAnswers(data, stage);
    };
    responsesRef.child(stageIndex).on("value", stageResponsesListener);

    stageResultsListener = (snapshot) => {
      const results = snapshot.val();
      renderResults(results, stage);
      let statusText = "未発表";
      if (results && results.awarded) {
        statusText = "順位付け済み";
      } else if (results && results.ranked && results.ranked.length > 0) {
        statusText = "結果表示済み";
      }
      masterNotice.textContent = explainVisible ? `${statusText} / 解説表示中` : statusText;
    };
    resultsRef.child(stageIndex).on("value", stageResultsListener);
    observedStageIndex = stageIndex;
  }

  async function computeResults() {
    const stage = getStageByIndex(currentStageIndex);
    const resultsSnap = await resultsRef.child(currentStageIndex).once("value");
    if (resultsSnap.exists()) {
      return resultsSnap.val();
    }

    const responsesSnap = await responsesRef.child(currentStageIndex).once("value");
    const responses = responsesSnap.val() || {};
    const playersSnap = await playersRef.once("value");
    const players = playersSnap.val() || {};

    const entries = Object.entries(players).map(([playerId, player]) => {
      const response = responses[playerId];
      if (response) {
        return {
          playerId,
          name: response.name || player.name || "No Name",
          value: Number(response.value),
          meta: response.meta || null,
          submittedAt: response.submittedAt || 0
        };
      }
      return {
        playerId,
        name: player.name || "No Name",
        value: null,
        meta: null,
        submittedAt: Number.POSITIVE_INFINITY
      };
    });

    Object.entries(responses).forEach(([playerId, response]) => {
      if (players[playerId]) {
        return;
      }
      entries.push({
        playerId,
        name: response.name || "No Name",
        value: Number(response.value),
        meta: response.meta || null,
        submittedAt: response.submittedAt || 0
      });
    });

    entries.sort((a, b) => {
      const diffA = computeDiff(a.value, stage);
      const diffB = computeDiff(b.value, stage);
      if (diffA !== diffB) {
        return diffA - diffB;
      }
      return a.submittedAt - b.submittedAt;
    });

    const ranked = [];
    let lastDiff = null;
    let lastRank = 0;
    entries.forEach((entry, index) => {
      const diff = computeDiff(entry.value, stage);
      if (index === 0 || diff !== lastDiff) {
        lastRank = index + 1;
        lastDiff = diff;
      }
      const rank = lastRank;
      const points = POINTS[rank - 1] || 0;
      ranked.push({
        playerId: entry.playerId,
        name: entry.name,
        value: entry.value,
        meta: entry.meta || null,
        rank,
        points
      });
    });

    const updates = {
      awarded: false,
      stageId: currentStageIndex,
      target: stage.target,
      updatedAt: Date.now(),
      ranked,
      includesAll: true
    };

    await resultsRef.child(currentStageIndex).set(updates);
    return updates;
  }

  async function showResults() {
    await computeResults();
    await setState({ phase: "reveal" });
  }

  async function showRanking() {
    const results = await computeResults();
    if (!results.awarded && results.ranked) {
      await Promise.all(
        results.ranked
          .filter((entry) => entry.points > 0)
          .map((entry) =>
            playersRef.child(entry.playerId).child("score").transaction((score) =>
              (score || 0) + entry.points
            )
          )
      );
      await resultsRef.child(currentStageIndex).update({
        awarded: true,
        updatedAt: Date.now()
      });
    }
    await setState({ phase: "rank" });
  }

  async function resetGame() {
    const confirmed = window.confirm("全ての回答・結果・スコアをリセットします。よろしいですか？");
    if (!confirmed) {
      return;
    }

    const playersSnap = await playersRef.once("value");
    const players = playersSnap.val() || {};
    const updates = {};

    Object.keys(players).forEach((playerId) => {
      updates[`players/${playerId}/score`] = 0;
    });
    updates["responses"] = null;
    updates["results"] = null;
    updates["game/state"] = { stageIndex: 1, phase: "waiting", explain: false };

    await db.ref().update(updates);
  }

  stateRef.on("value", (snapshot) => {
    const state = snapshot.val() || { stageIndex: 1, phase: "waiting" };
    currentStageIndex = clampStage(state.stageIndex || 1);
    currentPhase = state.phase || "waiting";
    explainVisible = Boolean(state.explain);
    phaseLabel.textContent = currentPhase;
    updateStageUI();
    watchStage(currentStageIndex);
  });

  playersRef.on("value", (snapshot) => {
    const players = snapshot.val() || {};
    playerCount.textContent = Object.keys(players).length;
    renderScores(players);
    renderPlayers(players);
  });

  prevStageBtn.addEventListener("click", () => {
    const next = clampStage(currentStageIndex - 1);
    setState({ stageIndex: next });
  });

  nextStageBtn.addEventListener("click", () => {
    const next = clampStage(currentStageIndex + 1);
    setState({ stageIndex: next });
  });

  setWaitingBtn.addEventListener("click", () => {
    setState({ phase: "waiting" });
  });

  setOpenBtn.addEventListener("click", () => {
    setState({ phase: "open" });
  });

  showResultsBtn.addEventListener("click", () => {
    showResults().catch((error) => {
      console.error(error);
      masterNotice.textContent = "結果表示でエラーが発生しました";
    });
  });

  showRankingBtn.addEventListener("click", () => {
    showRanking().catch((error) => {
      console.error(error);
      masterNotice.textContent = "順位付けでエラーが発生しました";
    });
  });

  showExplainBtn.addEventListener("click", () => {
    setState({ explain: true });
  });

  hideExplainBtn.addEventListener("click", () => {
    setState({ explain: false });
  });

  resetBtn.addEventListener("click", () => {
    resetGame().catch((error) => {
      console.error(error);
      masterNotice.textContent = "リセットに失敗しました";
    });
  });
})();

