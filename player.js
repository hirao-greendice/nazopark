(() => {
  const stateRef = db.ref("game/state");
  const playersRef = db.ref("players");
  const responsesRef = db.ref("responses");

  const registerPanel = document.getElementById("registerPanel");
  const registerStatus = document.getElementById("registerStatus");
  const playerBar = document.getElementById("playerBar");
  const gadgetSection = document.getElementById("gadgetSection");
  const gadgetArea = document.getElementById("gadgetArea");
  const submitBtn = document.getElementById("submitAnswer");
  const answerStatus = document.getElementById("answerStatus");

  const nameInput = document.getElementById("nameInput");
  const saveNameBtn = document.getElementById("saveName");
  const playerNameLabel = document.getElementById("playerNameLabel");
  const playerScoreLabel = document.getElementById("playerScoreLabel");

  const playerIdKey = "sense-player-id";
  const playerNameKey = "sense-player-name";
  const MAX_STAGE = GAME_STAGES.length;

  const playerId = localStorage.getItem(playerIdKey) || `p_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  localStorage.setItem(playerIdKey, playerId);

  let playerName = localStorage.getItem(playerNameKey) || "";
  let currentStageIndex = 1;
  let currentPhase = "waiting";
  let currentValue = null;
  let cleanupFns = [];
  let responseListener = null;
  let observedStageIndex = null;
  let playerListener = null;

  function clampStageIndex(index) {
    return Math.min(MAX_STAGE, Math.max(1, index));
  }

  function setRegisteredUI(registered) {
    registerPanel.hidden = registered;
    playerBar.hidden = !registered;
    gadgetSection.hidden = !registered;
  }

  function setRegisterStatus(text) {
    registerStatus.textContent = text;
  }

  function setAnswerStatus(text) {
    answerStatus.textContent = text;
  }

  function updateSubmitState() {
    const canSubmit = currentPhase === "open" && playerName && currentValue !== null;
    submitBtn.disabled = !canSubmit;
  }

  function setCurrentValue(value) {
    currentValue = value;
    updateSubmitState();
  }

  function clearGadget() {
    cleanupFns.forEach((fn) => fn());
    cleanupFns = [];
    gadgetArea.innerHTML = "";
    currentValue = null;
  }

  function createLabel(text) {
    const label = document.createElement("div");
    label.className = "notice";
    label.textContent = text;
    return label;
  }

  function renderStopwatch(stage) {
    let running = false;
    let startTime = 0;
    let elapsed = 0;
    let rafId = null;

    const timer = document.createElement("div");
    timer.className = "timer";
    timer.textContent = "0.00";

    const startBtn = document.createElement("button");
    startBtn.className = "btn";
    startBtn.textContent = "スタート";

    const stopBtn = document.createElement("button");
    stopBtn.className = "btn btn-outline";
    stopBtn.textContent = "ストップ";
    stopBtn.disabled = true;

    const resetBtn = document.createElement("button");
    resetBtn.className = "btn btn-ghost";
    resetBtn.textContent = "リセット";

    const row = document.createElement("div");
    row.className = "btn-row";
    row.append(startBtn, stopBtn, resetBtn);

    function updateTimer() {
      const now = performance.now();
      elapsed = (now - startTime) / 1000;
      timer.textContent = elapsed.toFixed(stage.precision ?? 2);
      rafId = requestAnimationFrame(updateTimer);
    }

    startBtn.addEventListener("click", () => {
      if (running || currentPhase !== "open") {
        return;
      }
      running = true;
      startTime = performance.now();
      stopBtn.disabled = false;
      startBtn.disabled = true;
      rafId = requestAnimationFrame(updateTimer);
    });

    stopBtn.addEventListener("click", () => {
      if (!running) {
        return;
      }
      running = false;
      cancelAnimationFrame(rafId);
      stopBtn.disabled = true;
      startBtn.disabled = false;
      setCurrentValue(Number(elapsed.toFixed(stage.precision ?? 2)));
      setAnswerStatus("計測完了。送信できます。");
    });

    resetBtn.addEventListener("click", () => {
      running = false;
      cancelAnimationFrame(rafId);
      elapsed = 0;
      timer.textContent = "0.00";
      stopBtn.disabled = true;
      startBtn.disabled = false;
      setCurrentValue(null);
      setAnswerStatus("未送信");
    });

    gadgetArea.append(timer, row);
    cleanupFns.push(() => cancelAnimationFrame(rafId));
  }

  function renderSlider(stage) {
    const valueLabel = document.createElement("div");
    valueLabel.className = "timer";
    valueLabel.textContent = stage.min.toFixed(stage.step >= 1 ? 0 : 2);

    const input = document.createElement("input");
    input.type = "range";
    input.min = stage.min;
    input.max = stage.max;
    input.step = stage.step;
    input.value = stage.min;
    input.style.width = "100%";

    const update = () => {
      const value = Number(input.value);
      valueLabel.textContent = value.toFixed(stage.step >= 1 ? 0 : 2);
      setCurrentValue(value);
    };

    input.addEventListener("input", update);
    update();

    gadgetArea.append(valueLabel, input);
  }

  function renderTap(stage) {
    let count = 0;
    let remaining = stage.duration;
    let intervalId = null;
    let active = false;

    const timer = document.createElement("div");
    timer.className = "timer";
    timer.textContent = `${stage.duration.toFixed(1)}s`;

    const countLabel = createLabel("タップ数: 0");

    const startBtn = document.createElement("button");
    startBtn.className = "btn";
    startBtn.textContent = "スタート";

    const tapBtn = document.createElement("button");
    tapBtn.className = "btn btn-outline";
    tapBtn.textContent = "TAP";
    tapBtn.disabled = true;

    const row = document.createElement("div");
    row.className = "btn-row";
    row.append(startBtn, tapBtn);

    function stopTimer() {
      clearInterval(intervalId);
      active = false;
      tapBtn.disabled = true;
      startBtn.disabled = false;
      setCurrentValue(count);
      setAnswerStatus("タップ完了。送信できます。");
    }

    startBtn.addEventListener("click", () => {
      if (currentPhase !== "open") {
        return;
      }
      count = 0;
      remaining = stage.duration;
      timer.textContent = `${remaining.toFixed(1)}s`;
      countLabel.textContent = "タップ数: 0";
      active = true;
      tapBtn.disabled = false;
      startBtn.disabled = true;
      setAnswerStatus("タップ中...");

      intervalId = setInterval(() => {
        remaining -= 0.1;
        if (remaining <= 0) {
          timer.textContent = "0.0s";
          stopTimer();
        } else {
          timer.textContent = `${remaining.toFixed(1)}s`;
        }
      }, 100);
    });

    tapBtn.addEventListener("click", () => {
      if (!active) {
        return;
      }
      count += 1;
      countLabel.textContent = `タップ数: ${count}`;
    });

    gadgetArea.append(timer, countLabel, row);
    cleanupFns.push(() => clearInterval(intervalId));
  }

  function renderHold(stage) {
    let startTime = 0;
    let holding = false;
    let rafId = null;

    const timer = document.createElement("div");
    timer.className = "timer";
    timer.textContent = "0.00";

    const holdBtn = document.createElement("button");
    holdBtn.className = "btn";
    holdBtn.textContent = "長押し";

    function update() {
      const now = performance.now();
      const elapsed = (now - startTime) / 1000;
      timer.textContent = elapsed.toFixed(stage.precision ?? 2);
      rafId = requestAnimationFrame(update);
    }

    function stopHold() {
      if (!holding) {
        return;
      }
      holding = false;
      cancelAnimationFrame(rafId);
      const value = Number(timer.textContent);
      setCurrentValue(value);
      setAnswerStatus("計測完了。送信できます。");
    }

    holdBtn.addEventListener("pointerdown", () => {
      if (currentPhase !== "open") {
        return;
      }
      holding = true;
      startTime = performance.now();
      rafId = requestAnimationFrame(update);
    });

    holdBtn.addEventListener("pointerup", stopHold);
    holdBtn.addEventListener("pointerleave", stopHold);
    holdBtn.addEventListener("pointercancel", stopHold);

    gadgetArea.append(timer, holdBtn);
    cleanupFns.push(() => cancelAnimationFrame(rafId));
  }

  function createEnableButton() {
    const btn = document.createElement("button");
    btn.className = "btn";
    btn.textContent = "センサー有効化";
    return btn;
  }

  function startOrientation(onEvent) {
    const handler = (event) => onEvent(event);
    window.addEventListener("deviceorientation", handler, true);
    return () => window.removeEventListener("deviceorientation", handler, true);
  }

  function setupOrientation(onEvent, container) {
    if (!window.DeviceOrientationEvent) {
      container.append(createLabel("この端末はセンサーに対応していません"));
      return () => {};
    }

    if (typeof DeviceOrientationEvent.requestPermission === "function") {
      const btn = createEnableButton();
      container.append(btn);
      btn.addEventListener("click", async () => {
        try {
          const permission = await DeviceOrientationEvent.requestPermission();
          if (permission === "granted") {
            btn.disabled = true;
            const stop = startOrientation(onEvent);
            cleanupFns.push(stop);
          } else {
            container.append(createLabel("許可が必要です"));
          }
        } catch (error) {
          console.error(error);
          container.append(createLabel("センサーの許可に失敗しました"));
        }
      });
      return () => {};
    }

    const stop = startOrientation(onEvent);
    cleanupFns.push(stop);
    return stop;
  }

  function renderGyro(stage) {
    const valueLabel = document.createElement("div");
    valueLabel.className = "timer";
    valueLabel.textContent = "0.0°";

    const hint = createLabel("スマホを縦に傾けてください");
    gadgetArea.append(valueLabel, hint);

    setupOrientation((event) => {
      if (event.beta === null || event.beta === undefined) {
        return;
      }
      const raw = Math.max(-90, Math.min(90, event.beta));
      const value = Number(raw.toFixed(stage.precision ?? 1));
      valueLabel.textContent = `${value}°`;
      setCurrentValue(value);
    }, gadgetArea);
  }

  function renderCompass(stage) {
    const valueLabel = document.createElement("div");
    valueLabel.className = "timer";
    valueLabel.textContent = "0.0°";

    const hint = createLabel("端末を水平にして回転させてください");
    gadgetArea.append(valueLabel, hint);

    setupOrientation((event) => {
      let heading = null;
      if (typeof event.webkitCompassHeading === "number") {
        heading = event.webkitCompassHeading;
      } else if (typeof event.alpha === "number") {
        heading = (360 - event.alpha) % 360;
      }
      if (heading === null || Number.isNaN(heading)) {
        return;
      }
      const value = Number(heading.toFixed(stage.precision ?? 1));
      valueLabel.textContent = `${value}°`;
      setCurrentValue(value);
    }, gadgetArea);
  }

  function renderTextLen() {
    const input = document.createElement("input");
    input.className = "input";
    input.placeholder = "文字を入力";

    const lengthLabel = createLabel("文字数: 0");

    input.addEventListener("input", () => {
      const length = Array.from(input.value).length;
      lengthLabel.textContent = `文字数: ${length}`;
      setCurrentValue(length);
    });

    gadgetArea.append(input, lengthLabel);
  }

  function renderNumber(stage) {
    const input = document.createElement("input");
    input.type = "number";
    input.className = "input";
    input.min = stage.min;
    input.max = stage.max;
    input.step = stage.step;

    input.addEventListener("input", () => {
      setCurrentValue(Number(input.value));
    });

    gadgetArea.append(input);
  }

  function renderChoice(stage) {
    const row = document.createElement("div");
    row.className = "choice-row";

    stage.options.forEach((option) => {
      const btn = document.createElement("button");
      btn.textContent = option;
      btn.addEventListener("click", () => {
        Array.from(row.children).forEach((child) => child.classList.remove("active"));
        btn.classList.add("active");
        setCurrentValue(option);
      });
      row.appendChild(btn);
    });

    gadgetArea.append(row);
  }

  function renderGrid() {
    const grid = document.createElement("div");
    grid.className = "grid-choice";

    for (let i = 1; i <= 9; i += 1) {
      const btn = document.createElement("button");
      btn.textContent = i;
      btn.addEventListener("click", () => {
        Array.from(grid.children).forEach((child) => child.classList.remove("active"));
        btn.classList.add("active");
        setCurrentValue(i);
      });
      grid.appendChild(btn);
    }

    gadgetArea.append(grid);
  }

  function renderGadget(stage) {
    clearGadget();
    if (currentPhase !== "open") {
      gadgetArea.append(createLabel("出題待ち"));
      updateSubmitState();
      return;
    }

    switch (stage.type) {
      case "gyro":
        renderGyro(stage);
        break;
      case "compass":
        renderCompass(stage);
        break;
      case "stopwatch":
        renderStopwatch(stage);
        break;
      case "slider":
        renderSlider(stage);
        break;
      case "tap":
        renderTap(stage);
        break;
      case "hold":
        renderHold(stage);
        break;
      case "textlen":
        renderTextLen(stage);
        break;
      case "number":
        renderNumber(stage);
        break;
      case "choice":
        renderChoice(stage);
        break;
      case "grid":
        renderGrid(stage);
        break;
      default:
        gadgetArea.append(createLabel("このステージのギミックが未設定です"));
    }

    updateSubmitState();
  }

  function updateStageUI() {
    const stage = getStageByIndex(currentStageIndex);
    renderGadget(stage);
  }

  function watchResponse(stageIndex) {
    if (responseListener) {
      responsesRef.child(observedStageIndex).child(playerId).off("value", responseListener);
    }
    responseListener = (snap) => {
      if (snap.exists()) {
        setAnswerStatus("送信済み");
      } else {
        setAnswerStatus("未送信");
      }
    };
    responsesRef.child(stageIndex).child(playerId).on("value", responseListener);
    observedStageIndex = stageIndex;
  }

  function watchPlayer() {
    if (playerListener) {
      playersRef.child(playerId).off("value", playerListener);
    }
    playerListener = (snap) => {
      const data = snap.val() || {};
      if (data.name) {
        playerName = data.name;
        localStorage.setItem(playerNameKey, playerName);
        playerNameLabel.textContent = playerName;
      }
      const score = data.score || 0;
      playerScoreLabel.textContent = `${score} pt`;
    };
    playersRef.child(playerId).on("value", playerListener);
  }

  function ensurePlayerRecord() {
    if (!playerName) {
      return;
    }
    playersRef.child(playerId).update({
      id: playerId,
      name: playerName,
      lastActive: Date.now()
    });
  }

  saveNameBtn.addEventListener("click", () => {
    const name = nameInput.value.trim();
    if (!name) {
      setRegisterStatus("名前を入力してください");
      return;
    }
    playerName = name;
    localStorage.setItem(playerNameKey, playerName);
    playerNameLabel.textContent = playerName;
    ensurePlayerRecord();
    watchPlayer();
    setRegisterStatus("登録完了");
    setRegisteredUI(true);
    updateSubmitState();
  });

  submitBtn.addEventListener("click", () => {
    if (currentPhase !== "open" || currentValue === null || !playerName) {
      return;
    }
    responsesRef.child(currentStageIndex).child(playerId).set({
      name: playerName,
      value: currentValue,
      submittedAt: Date.now()
    });
    playersRef.child(playerId).update({
      id: playerId,
      name: playerName,
      lastActive: Date.now()
    });
    setAnswerStatus("送信済み");
  });

  stateRef.on("value", (snapshot) => {
    const state = snapshot.val() || { stageIndex: 1, phase: "waiting" };
    currentStageIndex = clampStageIndex(state.stageIndex || 1);
    currentPhase = state.phase || "waiting";
    updateStageUI();
    watchResponse(currentStageIndex);
  });

  if (playerName) {
    playerNameLabel.textContent = playerName;
    setRegisteredUI(true);
    ensurePlayerRecord();
    watchPlayer();
  } else {
    setRegisteredUI(false);
  }

  watchResponse(currentStageIndex);
})();
